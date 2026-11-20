package expo.modules.travellifesignage

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.google.common.util.concurrent.ListenableFuture
import com.google.mlkit.genai.common.DownloadCallback
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.prompt.GenerateContentRequest
import com.google.mlkit.genai.prompt.GenerateContentResponse
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.java.GenerativeModelFutures
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executor

class TravelLifeSignageModule : Module() {
  private val landmark = LocalLandmarkRecognizer()

  override fun definition() = ModuleDefinition {
    Name("TravelLifeSignage")

    OnDestroy { landmark.close() }

    AsyncFunction("prepareLandmark") { value: String, promise: Promise ->
      try {
        val context = requireNotNull(appContext.reactContext)
        val uri = Uri.parse(value)
        require(uri.scheme == "file")
        val model = File(requireNotNull(uri.path)).canonicalFile
        require(listOf(context.cacheDir, context.filesDir).any {
          model.path.startsWith(it.canonicalPath + File.separator)
        })
        landmark.prepare(model)
        promise.resolve(null)
      } catch (_: Exception) {
        promise.reject("ERR_LANDMARK_MODEL", "Local model unavailable.", null)
      } catch (_: LinkageError) {
        promise.reject("ERR_LANDMARK_MODEL", "Local model unavailable.", null)
      }
    }

    AsyncFunction("readLandmark") { value: String, promise: Promise ->
      val resolver = appContext.reactContext?.contentResolver
      val uri = Uri.parse(value)
      if (resolver == null || uri.scheme !in listOf("file", "content")) {
        promise.reject("ERR_LANDMARK_DECODE", "Local image unavailable.", null)
        return@AsyncFunction
      }
      val bitmap = try {
        decodePreview(resolver, uri)
      } catch (_: Exception) {
        promise.reject("ERR_LANDMARK_DECODE", "Local image unavailable.", null)
        return@AsyncFunction
      }
      try {
        promise.resolve(landmark.read(bitmap, readRotation(resolver, uri)))
      } catch (_: LandmarkOutputError) {
        promise.reject("ERR_LANDMARK_SCHEMA", "Local recognition result unavailable.", null)
      } catch (_: Exception) {
        promise.reject("ERR_LANDMARK_INFERENCE", "Local recognition did not finish.", null)
      } finally {
        bitmap.recycle()
      }
    }

    // GPS-less trip discovery: capture-time offset tags and the containing
    // folder only. Never returns file names, media ids, GPS or timestamps.
    AsyncFunction("readCaptureMetadata") { value: String, promise: Promise ->
      val resolver = appContext.reactContext?.contentResolver
      val uri = Uri.parse(value)
      if (resolver == null || uri.scheme !in listOf("file", "content")) {
        promise.reject("ERR_CAPTURE_INPUT", "Local capture unavailable.", null)
        return@AsyncFunction
      }
      val directory = try {
        readRelativeDirectory(resolver, uri)
      } catch (_: SecurityException) {
        promise.reject("ERR_CAPTURE_ACCESS", "Local capture not permitted.", null)
        return@AsyncFunction
      } catch (_: Exception) {
        null
      }
      val exif = try {
        resolver.openInputStream(uri)?.use { ExifInterface(it) }
      } catch (_: SecurityException) {
        promise.reject("ERR_CAPTURE_ACCESS", "Local capture not permitted.", null)
        return@AsyncFunction
      } catch (_: Exception) {
        null
      }
      if (exif == null) {
        promise.reject("ERR_CAPTURE_DECODE", "Local capture unreadable.", null)
        return@AsyncFunction
      }
      // Presence only, never the coordinates themselves (diagnostic-logging
      // policy): a located capture belongs to the separate GPS reconstruction
      // engine, not GPS-less trip discovery (decision 0019).
      val hasLocation = try {
        exif.getLatLong(FloatArray(2))
      } catch (_: Exception) {
        false
      }
      promise.resolve(mapOf(
        "offsetTimeOriginal" to exif.getAttribute("OffsetTimeOriginal")?.take(16),
        "offsetTimeDigitized" to exif.getAttribute("OffsetTimeDigitized")?.take(16),
        // Local wall clock, no zone. Used only to cross-check against a true
        // UTC instant when no explicit offset tag is present (Story 1, Q2).
        "dateTimeOriginal" to exif.getAttribute("DateTimeOriginal")?.take(19),
        "relativeDirectory" to directory?.take(256),
        "hasLocation" to hasLocation,
      ))
    }

    // Story 1 Nano honesty eval (SPEC-gps-less-trip-discovery). Requires API
    // 26; this module's manifest overrides the library's higher minSdk, so
    // every function here guards Build.VERSION.SDK_INT itself and never runs
    // the library below 26. Only ever run against public eval images.
    AsyncFunction("checkNanoStatus") { promise: Promise ->
      if (Build.VERSION.SDK_INT < 26) {
        promise.resolve("unavailable")
        return@AsyncFunction
      }
      GenerativeModelFutures.from(Generation.getClient()).checkStatus().onComplete(
        onSuccess = { status ->
          promise.resolve(when (status) {
            FeatureStatus.AVAILABLE -> "available"
            FeatureStatus.DOWNLOADABLE -> "downloadable"
            FeatureStatus.DOWNLOADING -> "downloading"
            else -> "unavailable"
          })
        },
        onFailure = { promise.resolve("unavailable") },
      )
    }

    AsyncFunction("downloadNanoModel") { promise: Promise ->
      if (Build.VERSION.SDK_INT < 26) {
        promise.reject("ERR_NANO_UNAVAILABLE", "Local model unavailable.", null)
        return@AsyncFunction
      }
      var settled = false
      fun finishOnce(resolve: Boolean) {
        if (settled) return
        settled = true
        if (resolve) promise.resolve(null) else promise.reject("ERR_NANO_DOWNLOAD", "Local model download did not finish.", null)
      }
      val future = GenerativeModelFutures.from(Generation.getClient()).download(object : DownloadCallback {
        override fun onDownloadStarted(bytesToDownload: Long) {}
        override fun onDownloadProgress(totalBytesDownloaded: Long) {}
        override fun onDownloadCompleted() = finishOnce(true)
        override fun onDownloadFailed(e: GenAiException) = finishOnce(false)
      })
      future.onComplete(onSuccess = { finishOnce(true) }, onFailure = { finishOnce(false) })
    }

    AsyncFunction("nanoDescribeImage") { value: String, prompt: String, promise: Promise ->
      if (Build.VERSION.SDK_INT < 26) {
        promise.reject("ERR_NANO_UNAVAILABLE", "Local model unavailable.", null)
        return@AsyncFunction
      }
      val resolver = appContext.reactContext?.contentResolver
      val uri = Uri.parse(value)
      if (resolver == null || uri.scheme !in listOf("file", "content")) {
        promise.reject("ERR_NANO_INPUT", "Local image unavailable.", null)
        return@AsyncFunction
      }
      val bitmap = try {
        decodePreview(resolver, uri)
      } catch (_: Exception) {
        promise.reject("ERR_NANO_INPUT", "Local image unavailable.", null)
        return@AsyncFunction
      }
      val request = try {
        GenerateContentRequest.Builder(ImagePart(bitmap), TextPart(prompt.take(512))).build()
      } catch (_: Exception) {
        bitmap.recycle()
        promise.reject("ERR_NANO_INPUT", "Local image unavailable.", null)
        return@AsyncFunction
      }
      GenerativeModelFutures.from(Generation.getClient()).generateContent(request).onComplete(
        onSuccess = { response: GenerateContentResponse ->
          bitmap.recycle()
          val text = response.candidates.firstOrNull()?.text
          if (text == null) promise.reject("ERR_NANO_INFERENCE", "Local recognition did not finish.", null)
          else promise.resolve(text.trim().take(512))
        },
        onFailure = { error ->
          bitmap.recycle()
          promise.reject(nanoErrorCode((error as? GenAiException)?.errorCode), "Local recognition did not finish.", null)
        },
      )
    }

    AsyncFunction("readText") { value: String, promise: Promise ->
      val resolver = appContext.reactContext?.contentResolver
      val uri = Uri.parse(value)
      if (resolver == null || uri.scheme !in listOf("file", "content")) {
        promise.reject("ERR_SIGNAGE_DECODE", "Local image unavailable.", null)
        return@AsyncFunction
      }
      val bitmap: Bitmap
      val rotation: Int
      try {
        bitmap = decodePreview(resolver, uri)
        rotation = readRotation(resolver, uri)
      } catch (_: Exception) {
        promise.reject("ERR_SIGNAGE_DECODE", "Local image unavailable.", null)
        return@AsyncFunction
      }
      val recognizer = try {
        TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
      } catch (_: Exception) {
        bitmap.recycle()
        promise.reject("ERR_SIGNAGE_RECOGNITION", "Local recognition did not finish.", null)
        return@AsyncFunction
      }
      try {
        recognizer.process(InputImage.fromBitmap(bitmap, rotation)).addOnCompleteListener { result ->
          recognizer.close()
          bitmap.recycle()
          if (result.isSuccessful) {
            promise.resolve(result.result.textBlocks.take(48).map { it.text.take(256) })
          } else {
            promise.reject("ERR_SIGNAGE_RECOGNITION", "Local recognition did not finish.", null)
          }
        }
      } catch (_: Exception) {
        recognizer.close()
        bitmap.recycle()
        promise.reject("ERR_SIGNAGE_RECOGNITION", "Local recognition did not finish.", null)
      }
    }
  }

  /**
   * Bridges a ListenableFuture without depending on full Guava's `Futures`
   * helpers (only the stub `ListenableFuture` interface is guaranteed on the
   * classpath). Runs the callback inline on whatever thread completes it.
   */
  private fun <T> ListenableFuture<T>.onComplete(onSuccess: (T) -> Unit, onFailure: (Throwable) -> Unit) {
    addListener({
      try {
        onSuccess(get())
      } catch (error: ExecutionException) {
        onFailure(error.cause ?: error)
      } catch (error: Exception) {
        onFailure(error)
      }
    }, Executor { it.run() })
  }

  /** GenAiException.ErrorCode -> a fixed, narrow rejection code. Never logs the code or message. */
  private fun nanoErrorCode(errorCode: Int?): String = when (errorCode) {
    9, 27 -> "ERR_NANO_BUSY" // BUSY, PER_APP_BATTERY_USE_QUOTA_EXCEEDED
    30 -> "ERR_NANO_BACKGROUND" // BACKGROUND_USE_BLOCKED
    8, 16, -101, 604 -> "ERR_NANO_UNAVAILABLE" // NOT_AVAILABLE, NOT_SUPPORTED, AICORE_INCOMPATIBLE, NEEDS_SYSTEM_UPDATE
    -102, 12, -100 -> "ERR_NANO_INPUT" // INVALID_INPUT_IMAGE, REQUEST_TOO_LARGE, REQUEST_TOO_SMALL
    else -> "ERR_NANO_INFERENCE"
  }

  /** Folder relative to the storage volume, e.g. `DCIM/Camera/`. The file name is dropped. */
  private fun readRelativeDirectory(resolver: ContentResolver, uri: Uri): String? {
    if (uri.scheme == "file") {
      val path = uri.path ?: return null
      return Regex("^/storage/(?:emulated/\\d+|[A-Za-z0-9-]+)/(.*/)[^/]+$").find(path)?.groupValues?.get(1)
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
    return resolver.query(uri, arrayOf(MediaStore.MediaColumns.RELATIVE_PATH), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    }
  }

  private fun decodePreview(resolver: ContentResolver, uri: Uri): Bitmap {
    val dimensions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, dimensions) }
    require(dimensions.outWidth in 1..65000 && dimensions.outHeight in 1..65000)
    val options = BitmapFactory.Options().apply {
      var sample = 1
      val longEdge = maxOf(dimensions.outWidth, dimensions.outHeight)
      while (longEdge / sample > 1600) sample *= 2
      inSampleSize = sample
    }
    return requireNotNull(resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) })
  }

  private fun readRotation(resolver: ContentResolver, uri: Uri): Int {
    val orientation = try {
      resolver.openInputStream(uri)?.use {
        ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      }
    } catch (_: Exception) {
      null
    }
    return when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90, ExifInterface.ORIENTATION_TRANSPOSE -> 90
      ExifInterface.ORIENTATION_ROTATE_180, ExifInterface.ORIENTATION_FLIP_VERTICAL -> 180
      ExifInterface.ORIENTATION_ROTATE_270, ExifInterface.ORIENTATION_TRANSVERSE -> 270
      else -> 0
    }
  }
}
