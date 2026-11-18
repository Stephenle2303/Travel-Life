package expo.modules.travellifesignage

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Base64
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

internal class LocalLandmarkRecognizer {
  private var session: OrtSession? = null

  @Synchronized
  fun prepare(model: File) {
    if (session != null) return
    session = OrtSession.SessionOptions().use { options ->
      options.setIntraOpNumThreads(2)
      options.setInterOpNumThreads(1)
      OrtEnvironment.getEnvironment().createSession(model.path, options)
    }
  }

  @Synchronized
  fun read(bitmap: Bitmap, rotation: Int): String {
    val active = checkNotNull(session)
    val input = rgbInput(bitmap, rotation)
    val shape = longArrayOf(1, 3, imageSize.toLong(), imageSize.toLong())
    return OnnxTensor.createTensor(OrtEnvironment.getEnvironment(), FloatBuffer.wrap(input), shape).use { tensor ->
      active.run(mapOf("pixel_values" to tensor)).use { output ->
        val result = output.get("last_hidden_state").orElse(null) as? OnnxTensor
          ?: throw LandmarkOutputError()
        val info = result.info as? TensorInfo ?: throw LandmarkOutputError()
        if (!info.shape.contentEquals(longArrayOf(1, 257, 384))) throw LandmarkOutputError()
        val features = result.floatBuffer ?: throw LandmarkOutputError()
        if (features.remaining() != 257 * 384) throw LandmarkOutputError()
        val bytes = ByteBuffer.allocate(features.remaining() * Float.SIZE_BYTES).order(ByteOrder.LITTLE_ENDIAN)
        bytes.asFloatBuffer().put(features)
        Base64.encodeToString(bytes.array(), Base64.NO_WRAP)
      }
    }
  }

  @Synchronized
  fun close() {
    session?.close()
    session = null
  }

  private fun rgbInput(bitmap: Bitmap, rotation: Int): FloatArray {
    val oriented = if (rotation == 0) bitmap else Bitmap.createBitmap(
      bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(rotation.toFloat()) }, true
    )
    try {
      val scaled = Bitmap.createScaledBitmap(oriented, imageSize, imageSize, true)
      try {
        val area = imageSize * imageSize
        val pixels = IntArray(area)
        scaled.getPixels(pixels, 0, imageSize, 0, 0, imageSize, imageSize)
        val result = FloatArray(area * 3)
        for (index in pixels.indices) {
          val pixel = pixels[index]
          result[index] = (((pixel shr 16 and 255) / 255f) - 0.485f) / 0.229f
          result[area + index] = (((pixel shr 8 and 255) / 255f) - 0.456f) / 0.224f
          result[2 * area + index] = (((pixel and 255) / 255f) - 0.406f) / 0.225f
        }
        return result
      } finally {
        if (scaled !== oriented) scaled.recycle()
      }
    } finally {
      if (oriented !== bitmap) oriented.recycle()
    }
  }

  companion object {
    private const val imageSize = 224
  }
}

internal class LandmarkOutputError : Exception()
