import Foundation
import Vision
import AppKit
let url=URL(fileURLWithPath:CommandLine.arguments[1])
let request=VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages=["zh-Hans","en-US"]
request.usesLanguageCorrection=true
try VNImageRequestHandler(url:url).perform([request])
let items=(request.results ?? []).compactMap { observation -> [String:Any]? in
 guard let text=observation.topCandidates(1).first else{return nil}
 let r=observation.boundingBox
 return ["text":text.string,"confidence":text.confidence,"rect":[r.minX,r.minY,r.width,r.height]]
}
print(String(data:try JSONSerialization.data(withJSONObject:items),encoding:.utf8)!)
