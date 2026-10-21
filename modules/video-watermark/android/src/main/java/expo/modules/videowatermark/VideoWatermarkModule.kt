package expo.modules.videowatermark

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.TextureOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class WatermarkException(message: String) : CodedException("Video watermark failed: $message")

@OptIn(UnstableApi::class)
class VideoWatermarkModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VideoWatermark")

    AsyncFunction("getVideoSize") { uri: String ->
      val (width, height) = displaySize(pathOf(uri))
      mapOf("width" to width, "height" to height)
    }

    AsyncFunction("stamp") { videoUri: String, overlayUri: String, promise: Promise ->
      val videoPath = pathOf(videoUri)
      val (width, height) = displaySize(videoPath)
      val source = BitmapFactory.decodeFile(pathOf(overlayUri))
        ?: throw WatermarkException("could not read overlay image")
      // Media3 sizes an overlay by its pixel size relative to the frame, so a
      // bitmap matching the frame exactly covers it edge to edge.
      val bitmap = Bitmap.createScaledBitmap(source, width, height, true)
      val overlays = listOf<TextureOverlay>(BitmapOverlay.createStaticBitmapOverlay(bitmap))
      val editedItem = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(File(videoPath))))
        .setEffects(Effects(emptyList<AudioProcessor>(), listOf<Effect>(OverlayEffect(overlays))))
        .build()
      val output = File(context.cacheDir, "watermark-${System.currentTimeMillis()}.mp4")

      // Transformer must be built and started on a thread with a Looper.
      Handler(Looper.getMainLooper()).post {
        try {
          Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .addListener(object : Transformer.Listener {
              override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                promise.resolve(Uri.fromFile(output).toString())
              }

              override fun onError(
                composition: Composition,
                exportResult: ExportResult,
                exportException: ExportException
              ) {
                output.delete()
                promise.reject(WatermarkException(exportException.message ?: "export failed"))
              }
            })
            .build()
            .start(editedItem, output.absolutePath)
        } catch (e: Exception) {
          promise.reject(WatermarkException(e.message ?: "could not start export"))
        }
      }
    }
  }

  // Accepts both file:// URIs and bare paths.
  private fun pathOf(uri: String): String = Uri.parse(uri).path ?: uri

  // Width/height as the video is displayed, i.e. swapped for portrait phone
  // videos that are stored landscape with a 90/270 degree rotation tag.
  private fun displaySize(path: String): Pair<Int, Int> {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(path)
      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull()
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull()
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      if (width == null || height == null) throw WatermarkException("could not read video size")
      return if (rotation % 180 == 0) width to height else height to width
    } finally {
      retriever.release()
    }
  }
}
