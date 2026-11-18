import ExpoModulesCore
import Foundation
import ImageIO
import Vision

private final class SignageDecodeException: Exception {
  override var reason: String { "Local image unavailable." }
}

public final class TravelLifeSignageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TravelLifeSignage")

    AsyncFunction("readText") { (value: String) -> [String] in
      guard let url = URL(string: value), url.isFileURL,
            let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
              kCGImageSourceCreateThumbnailFromImageAlways: true,
              kCGImageSourceCreateThumbnailWithTransform: true,
              kCGImageSourceThumbnailMaxPixelSize: 1600
            ] as CFDictionary) else {
        throw SignageDecodeException()
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      let supported = try request.supportedRecognitionLanguages()
      let languages = ["ko-KR", "en-US"].filter { supported.contains($0) }
      if !languages.isEmpty { request.recognitionLanguages = languages }
      try VNImageRequestHandler(cgImage: thumbnail, options: [:]).perform([request])
      return (request.results ?? []).prefix(48).compactMap { observation in
        observation.topCandidates(1).first.map { String($0.string.prefix(256)) }
      }
    }
  }
}
