import AVFoundation
import ExpoModulesCore
import UIKit

final class WatermarkException: GenericException<String> {
  override var reason: String {
    "Video watermark failed: \(param)"
  }
}

public class VideoWatermarkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoWatermark")

    AsyncFunction("getVideoSize") { (uri: String) async throws -> [String: Double] in
      let track = try await firstVideoTrack(of: AVURLAsset(url: fileURL(uri)))
      let (_, size) = try await uprightTransform(of: track)
      return ["width": Double(size.width), "height": Double(size.height)]
    }

    AsyncFunction("stamp") { (videoUri: String, overlayUri: String) async throws -> String in
      try await stamp(video: fileURL(videoUri), overlay: fileURL(overlayUri)).absoluteString
    }
  }
}

private func fileURL(_ uri: String) -> URL {
  if let url = URL(string: uri), url.isFileURL {
    return url
  }
  return URL(fileURLWithPath: uri)
}

private func firstVideoTrack(of asset: AVAsset) async throws -> AVAssetTrack {
  guard let track = try await asset.loadTracks(withMediaType: .video).first else {
    throw WatermarkException("no video track")
  }
  return track
}

// Phone videos are stored landscape with a rotation in preferredTransform.
// Returns that transform shifted so the rotated frame starts at (0, 0), plus
// the upright (display) size it produces.
private func uprightTransform(of track: AVAssetTrack) async throws -> (CGAffineTransform, CGSize) {
  let (naturalSize, transform) = try await track.load(.naturalSize, .preferredTransform)
  let rect = CGRect(origin: .zero, size: naturalSize).applying(transform)
  let upright = transform.concatenating(CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
  return (upright, CGSize(width: rect.width.rounded(), height: rect.height.rounded()))
}

private func stamp(video: URL, overlay: URL) async throws -> URL {
  guard let overlayImage = UIImage(contentsOfFile: overlay.path)?.cgImage else {
    throw WatermarkException("could not read overlay image")
  }

  let asset = AVURLAsset(url: video)
  let sourceVideo = try await firstVideoTrack(of: asset)
  let duration = try await asset.load(.duration)
  let timeRange = CMTimeRange(start: .zero, duration: duration)

  let composition = AVMutableComposition()
  guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
    throw WatermarkException("could not create video track")
  }
  try videoTrack.insertTimeRange(timeRange, of: sourceVideo, at: .zero)
  if let sourceAudio = try await asset.loadTracks(withMediaType: .audio).first,
     let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
    try audioTrack.insertTimeRange(timeRange, of: sourceAudio, at: .zero)
  }

  let (transform, renderSize) = try await uprightTransform(of: sourceVideo)
  let frameRate = try await sourceVideo.load(.nominalFrameRate)

  let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
  layerInstruction.setTransform(transform, at: .zero)
  let instruction = AVMutableVideoCompositionInstruction()
  instruction.timeRange = timeRange
  instruction.layerInstructions = [layerInstruction]

  // The overlay PNG is drawn at the video's aspect ratio, so stretching it to
  // the full frame lines it up exactly.
  let frame = CGRect(origin: .zero, size: renderSize)
  let videoLayer = CALayer()
  videoLayer.frame = frame
  let overlayLayer = CALayer()
  overlayLayer.frame = frame
  overlayLayer.contents = overlayImage
  overlayLayer.contentsGravity = .resize
  let parentLayer = CALayer()
  parentLayer.frame = frame
  parentLayer.addSublayer(videoLayer)
  parentLayer.addSublayer(overlayLayer)

  let videoComposition = AVMutableVideoComposition()
  videoComposition.renderSize = renderSize
  videoComposition.frameDuration = CMTime(value: 1, timescale: frameRate > 0 ? CMTimeScale(frameRate.rounded()) : 30)
  videoComposition.instructions = [instruction]
  videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
    postProcessingAsVideoLayer: videoLayer,
    in: parentLayer
  )

  guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
    throw WatermarkException("could not create export session")
  }
  let output = FileManager.default.temporaryDirectory
    .appendingPathComponent("watermark-\(UUID().uuidString).mp4")
  session.outputURL = output
  session.outputFileType = .mp4
  session.videoComposition = videoComposition
  session.shouldOptimizeForNetworkUse = true

  await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
    session.exportAsynchronously {
      continuation.resume()
    }
  }
  guard session.status == .completed else {
    try? FileManager.default.removeItem(at: output)
    throw WatermarkException(session.error?.localizedDescription ?? "export ended with status \(session.status.rawValue)")
  }
  return output
}
