package expo.modules.travellifesignage

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

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
      promise.resolve(mapOf(
        "offsetTimeOriginal" to exif.getAttribute("OffsetTimeOriginal")?.take(16),
        "offsetTimeDigitized" to exif.getAttribute("OffsetTimeDigitized")?.take(16),
        "relativeDirectory" to directory?.take(256),
      ))
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
