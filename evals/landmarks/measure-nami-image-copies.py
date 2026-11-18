import json
import sys
from pathlib import Path

import cv2
import numpy as np

directory = Path(sys.argv[1]).resolve()
manifest = json.loads(Path(__file__).with_name("nami-visual-v1.json").read_text(encoding="utf-8-sig"))
photos = manifest["photos"]
references = [item for item in photos if item["role"] == "reference"]
queries = [item for item in photos if item["role"].startswith("query")]
extractor = cv2.SIFT_create(nfeatures=1300)
matcher = cv2.BFMatcher(cv2.NORM_L2)
cv2.setNumThreads(2)
cv2.setRNGSeed(3176)


def features(photo):
    image = cv2.imdecode(np.fromfile(directory / photo["file"], dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError("IMAGE_DECODE")
    scale = min(1, 1100 / max(image.shape))
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    keypoints, descriptors = extractor.detectAndCompute(image, None)
    return image.shape, np.array([p.pt for p in keypoints]), descriptors


def compare(a, b):
    a_shape, a_points, a_descriptors = a
    _, b_points, b_descriptors = b
    if a_descriptors is None or b_descriptors is None or len(b_descriptors) < 2:
        return {"inliers": 0, "consistentFraction": 0, "sourceCoverage": 0}
    pairs = [pair[0] for pair in matcher.knnMatch(a_descriptors, b_descriptors, k=2)
             if len(pair) == 2 and pair[0].distance < 0.75 * pair[1].distance]
    if len(pairs) < 4:
        return {"inliers": 0, "consistentFraction": 0, "sourceCoverage": 0}
    src = np.float32([a_points[m.queryIdx] for m in pairs])
    dst = np.float32([b_points[m.trainIdx] for m in pairs])
    _, mask = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
    if mask is None:
        return {"inliers": 0, "consistentFraction": 0, "sourceCoverage": 0}
    keep = mask.reshape(-1) == 1
    inliers = int(keep.sum())
    if inliers < 4:
        return {"inliers": inliers, "consistentFraction": 0, "sourceCoverage": 0}
    hull = cv2.convexHull(src[keep])
    coverage = cv2.contourArea(hull) / (a_shape[0] * a_shape[1])
    return {"inliers": inliers, "consistentFraction": round(inliers / len(pairs), 4), "sourceCoverage": round(coverage, 4)}


features_by_id = {row["id"]: features(row) for row in references + queries}
results = []
for query in queries:
    for ref in references:
        scores = compare(features_by_id[ref["id"]], features_by_id[query["id"]])
        possible_copy = scores["inliers"] >= 25 and scores["consistentFraction"] >= 0.55 and scores["sourceCoverage"] >= 0.2
        results.append({"query": query["id"], "reference": ref["id"], "possibleCopy": possible_copy, **scores})

(directory / "nami-visual-copy-report.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
