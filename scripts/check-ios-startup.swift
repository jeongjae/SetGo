// Inspect the actual iPhone Simulator screenshot, not just a successful Xcode build.
import Foundation
import ImageIO
import Vision

guard CommandLine.arguments.count == 2,
      let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fatalError("Expected an iPhone startup screenshot")
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-US", "ko-KR"]
try VNImageRequestHandler(cgImage: image).perform([request])
let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
print(text)
let english = ["Today", "Routines", "History", "Insights", "More"]
let korean = ["오늘", "루틴", "기록", "인사이트", "더보기"]
let count = max(english.filter { text.localizedCaseInsensitiveContains($0) }.count,
                korean.filter { text.contains($0) }.count)
guard text.localizedCaseInsensitiveContains("SetGo"), count >= 3 else {
    fatalError("SetGo's first screen and primary navigation did not render; inspect SetGo-startup.png")
}
print("SetGo first screen and primary navigation rendered on iPhone Simulator.")
