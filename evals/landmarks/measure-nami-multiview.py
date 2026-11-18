"""Measure geometry on the pinned public Nami pairs. No GPS or EXIF input."""

import argparse
from contextlib import contextmanager
from hashlib import sha256
import json
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile
from uuid import uuid4


FIXTURE_PIN = "0def651c68464b15d918ed952e68ae535b532f314f82e93cee5400b32921c908"
PHOTO_MANIFEST_PIN = "576bef18d90e8293c8bf782a6aacb598909f0abe19673c1cb3e2e7ad7e4acf93"


class EvaluationError(Exception):
    pass


class Run:
    def __init__(self):
        self.correlation_id = str(uuid4())

    def emit(self, stage, reason, outcome):
        event = {
            "operation": "LANDMARK_PUBLIC_EVAL",
            "stage": stage,
            "reasonCode": reason,
            "retryable": False,
            "durableOutcome": outcome,
            "correlationId": self.correlation_id,
        }
        print(json.dumps(event), file=sys.stderr)

    @contextmanager
    def stage(self, name, failure="UNKNOWN"):
        self.emit(name, "START", "unchanged")
        try:
            yield
        except KeyboardInterrupt:
            self.emit(name, "CANCELLED", "skipped")
            raise
        except EvaluationError as error:
            self.emit(name, error.args[0], "unchanged")
            raise
        except Exception:
            self.emit(name, failure, "unchanged")
            raise
        self.emit(name, "COMPLETE", "complete")


def measure_points(left, right, left_shape, right_shape):
    """Both models see the same matches. Coverage is measured in both frames."""
    import cv2
    import numpy as np

    def coverage(points, shape):
        if len(points) < 3:
            return 0.0
        return float(cv2.contourArea(cv2.convexHull(points)) / (shape[0] * shape[1]))

    def spread(mask):
        return min(coverage(left[mask], left_shape), coverage(right[mask], right_shape))

    pairs = len(left)
    if pairs < 8:
        return {"correspondences": pairs, "epipolarInliers": 0, "planarInliers": 0,
                "planarCoveragePpm": 0, "epipolarCoveragePpm": 0, "depthInliers": 0, "depthCoveragePpm": 0}

    cv2.setRNGSeed(3176)
    _, planar = cv2.findHomography(left, right, cv2.USAC_MAGSAC, 3.0, maxIters=2000)
    _, epipolar = cv2.findFundamentalMat(left, right, cv2.USAC_MAGSAC, 1.5, 0.999, 4000)
    planar = planar.reshape(-1).astype(bool) if planar is not None else np.zeros(pairs, dtype=bool)
    epipolar = epipolar.reshape(-1).astype(bool) if epipolar is not None else np.zeros(pairs, dtype=bool)
    depth = epipolar & ~planar
    return {
        "correspondences": pairs,
        "epipolarInliers": int(epipolar.sum()),
        "planarInliers": int(planar.sum()),
        "planarCoveragePpm": round(spread(planar) * 1_000_000),
        "epipolarCoveragePpm": round(spread(epipolar) * 1_000_000),
        "depthInliers": int(depth.sum()),
        "depthCoveragePpm": round(spread(depth) * 1_000_000),
    }


def measure_pair(a, b, matcher):
    import numpy as np

    def directed(source, destination):
        if source is None or destination is None or len(destination) < 2:
            return {}
        return {first.queryIdx: first.trainIdx for first, second in matcher.knnMatch(source, destination, k=2)
                if first.distance < 0.8 * second.distance}

    shape_a, points_a, descriptors_a = a
    shape_b, points_b, descriptors_b = b
    a_to_b = directed(descriptors_a, descriptors_b)
    b_to_a = directed(descriptors_b, descriptors_a)
    mutual = [(i, j) for i, j in a_to_b.items() if b_to_a.get(j) == i]
    left = np.asarray([points_a[i] for i, _ in mutual], dtype=np.float32)
    right = np.asarray([points_b[j] for _, j in mutual], dtype=np.float32)
    return measure_points(left, right, shape_a, shape_b)


def synthetic_controls(np):
    rng = np.random.default_rng(17205)
    depths = rng.uniform(3, 11, 96)
    points = np.column_stack([rng.uniform(-0.35, 0.35, (96, 2)) * depths[:, None], depths])
    rotation = np.array([[0.9968, 0.0, 0.0799], [0.0, 1.0, 0.0], [-0.0799, 0.0, 0.9968]])

    def project(xyz):
        return np.float32(xyz[:, :2] / xyz[:, 2:] * 850 + [500, 380])

    left = project(points)
    right = project(points @ rotation.T + [0.45, 0.12, 0.0])
    flat = np.column_stack([left, np.ones(len(left))]) @ np.array([
        [0.85, 0.02, 0.00012], [-0.05, 0.92, -0.00016], [50, 35, 1],
    ])
    planar = np.float32(flat[:, :2] / flat[:, 2:])
    shape = (760, 1000)
    return {
        "nonplanar": measure_points(left, right, shape, shape),
        "planar": measure_points(left, planar, shape, shape),
        "unrelated": measure_points(left, right[rng.permutation(len(right))], shape, shape),
    }


def publish(destination, report):
    reservation = destination.with_name(destination.name + ".lock")
    try:
        reservation.mkdir()
    except FileExistsError:
        raise EvaluationError("OUTPUT_EXISTS")
    temporary = None
    try:
        if destination.exists():
            raise EvaluationError("OUTPUT_EXISTS")
        with NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=destination.parent,
                                prefix=".nami-multiview-", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(report, handle, indent=2)
            handle.write("\n")
        if destination.exists():
            raise EvaluationError("OUTPUT_EXISTS")
        temporary.rename(destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        reservation.rmdir()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    run = Run()
    with run.stage("MODEL_LOAD", "MODEL_UNAVAILABLE"):
        import cv2
        import numpy as np
        cv2.setNumThreads(2)
        detector = cv2.SIFT_create(nfeatures=2500)
        matcher = cv2.BFMatcher(cv2.NORM_L2)
    with run.stage("SOURCE_READ", "INPUT_UNAVAILABLE"):
        fixture_bytes = Path(__file__).with_name("nami-multiview-v1.json").read_bytes()
        manifest_bytes = Path(__file__).with_name("nami-visual-v1.json").read_bytes()
        if sha256(fixture_bytes).hexdigest() != FIXTURE_PIN or sha256(manifest_bytes).hexdigest() != PHOTO_MANIFEST_PIN:
            raise EvaluationError("INPUT_INTEGRITY")
        fixture = json.loads(fixture_bytes)
        manifest = json.loads(manifest_bytes.decode("utf-8-sig"))
        photo_rows = {row["id"]: row for row in manifest["photos"]}
        images = {}
        for photo_id in sorted({item for pair in fixture["pairs"] for item in pair["photos"]}):
            row = photo_rows[photo_id]
            if Path(row["file"]).name != row["file"]:
                raise EvaluationError("INPUT_INTEGRITY")
            with (args.directory / row["file"]).open("rb") as source:
                data = source.read(10 * 1024 * 1024 + 1)
            if len(data) > 10 * 1024 * 1024 or sha256(data).hexdigest() != row["sha256"]:
                raise EvaluationError("INPUT_INTEGRITY")
            images[photo_id] = data
    with run.stage("IMAGE_DECODE", "IMAGE_DECODE"):
        decoded = {}
        for photo_id, data in images.items():
            image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
            if image is None:
                raise EvaluationError("IMAGE_DECODE")
            scale = min(1, 1100 / max(image.shape))
            decoded[photo_id] = cv2.resize(image, None, fx=scale, fy=scale,
                                           interpolation=cv2.INTER_AREA) if scale < 1 else image
    with run.stage("DESCRIPTOR_GENERATE", "MODEL_INFERENCE"):
        features = {}
        for photo_id, image in decoded.items():
            keypoints, descriptors = detector.detectAndCompute(image, None)
            features[photo_id] = (image.shape, [point.pt for point in keypoints], descriptors)
    with run.stage("BENCHMARK_SCORE"):
        pairs = [{"id": pair["id"], "photos": pair["photos"],
                  **measure_pair(*(features[photo_id] for photo_id in pair["photos"]), matcher)}
                 for pair in fixture["pairs"]]
        controls = synthetic_controls(np)
    with run.stage("ARTIFACT_WRITE", "ARTIFACT_WRITE"):
        publish(args.destination, {"version": 1, "fixtureSha256": FIXTURE_PIN,
                                   "opencv": cv2.__version__, "pairs": pairs, "controls": controls})


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
    except Exception:
        sys.exit(2)
