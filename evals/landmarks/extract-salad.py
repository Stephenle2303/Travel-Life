"""Extract offline SALAD descriptors for the frozen public Atlas fixture."""

import argparse
from hashlib import file_digest, sha256
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
from time import perf_counter
from unittest.mock import patch
from uuid import uuid4
import warnings
from zipfile import ZipFile


SALAD_COMMIT = "6aede13a3f6c25750bf7fde10209c06cb73060bb"
DINO_COMMIT = "7764ea0f912e53c92e82eb78a2a1631e92725fc8"
SALAD_ARCHIVE_SHA = "79e76bdf02df0345a821b2536fdd63e28bb3bfbe19ccd22916c56d2020b22a90"
DINO_ARCHIVE_SHA = "04276715cddb29d45d05bff3a6fc132224dc27749b279ac98ad2ce4620e20d48"
MODEL_SHA = "6b3f1720954293e83da6966c5cfcfc6713200d7fefadcca76fc51aeb80b3cada"


def digest(file):
    with file.open("rb") as source:
        return file_digest(source, "sha256").hexdigest()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def admitted_photos(manifest, manifest_sha):
    # Share the benchmark's admission rules before opening any JPEG.
    runner = Path(__file__).resolve().parents[2] / "apps/mobile/scripts/offline-landmark-input.cjs"
    result = subprocess.run(
        ["node", "-e", """
          const [moduleFile, manifest, digest] = process.argv.slice(1);
          const api = require(moduleFile);
          const input = api.parseManifest(api.readPinned(manifest, digest));
          const { references, queries } = api.auditSnapshot(input, api.mapPlaces(input.places));
          process.stdout.write(JSON.stringify({
            model: input.saladModelSha256, photos: [...references, ...queries],
          }));
        """, str(runner), str(manifest), manifest_sha],
        check=True, capture_output=True, timeout=15,
    )
    return json.loads(result.stdout)


def load_model(torch, source_dir, checkpoint):
    salad_root = source_dir / f"salad-{SALAD_COMMIT}"
    sys.path.insert(0, str(source_dir / f"dinov2-{DINO_COMMIT}"))
    from dinov2.hub.backbones import dinov2_vitb14

    encoder = load_module("salad_backbone", salad_root / "models/backbones/dinov2.py")
    pooling = load_module("salad_aggregator", salad_root / "models/aggregators/salad.py")
    # The release state dict contains the full backbone. Prevent the upstream
    # wrapper from downloading a second copy of the DINOv2 weights.
    backbone_model = dinov2_vitb14(pretrained=False)
    with patch.object(torch.hub, "load", return_value=backbone_model):
        backbone = encoder.DINOv2(num_trainable_blocks=4, return_token=True, norm_layer=True)
    aggregator = pooling.SALAD(num_channels=768, num_clusters=64, cluster_dim=128, token_dim=256)
    model = torch.nn.Sequential()
    model.add_module("backbone", backbone)
    model.add_module("aggregator", aggregator)
    model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True), strict=True)
    return model.eval()


def emit(reason, stage, correlation, outcome):
    print(json.dumps({
        "operation": "LANDMARK_SALAD_EXTRACT",
        "reasonCode": reason,
        "stage": stage,
        "retryable": reason == "SALAD_OUTPUT",
        "durableOutcome": outcome,
        "correlationId": correlation,
    }), file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("manifest_sha256")
    parser.add_argument("photos", type=Path)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("salad_archive", type=Path)
    parser.add_argument("dino_archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    correlation = str(uuid4())
    stage = "SALAD_INPUT_INVALID"
    try:
        snapshot = admitted_photos(args.manifest, args.manifest_sha256)
        if snapshot["model"] != MODEL_SHA:
            raise ValueError
        photos = snapshot["photos"]
        if not photos or any(
            not re.fullmatch(r"[\w.-]+\.jpe?g", photo["file"], re.ASCII | re.IGNORECASE)
            or not re.fullmatch(r"[a-f0-9]{64}", photo["sha256"])
            for photo in photos
        ):
            raise ValueError

        stage = "SALAD_MODEL_INTEGRITY"
        for file, expected in (
            (args.salad_archive, SALAD_ARCHIVE_SHA),
            (args.dino_archive, DINO_ARCHIVE_SHA),
            (args.checkpoint, MODEL_SHA),
        ):
            if digest(file) != expected:
                raise ValueError

        stage = "SALAD_MODEL_LOAD"
        import torch
        from PIL import Image
        from torchvision import transforms

        torch.set_num_threads(2)
        with TemporaryDirectory(dir=args.output.parent) as temp, warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="xFormers is (disabled|not available).*")
            for archive in (args.salad_archive, args.dino_archive):
                with ZipFile(archive) as zipped:
                    zipped.extractall(temp)
            model = load_model(torch, Path(temp), args.checkpoint)

        transform = transforms.Compose([
            transforms.Resize((322, 322), interpolation=transforms.InterpolationMode.BILINEAR),
            transforms.ToTensor(),
            transforms.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ])
        descriptors = {}
        times = []
        with torch.inference_mode():
            for photo in photos:
                stage = "SALAD_IMAGE_INTEGRITY"
                start = perf_counter()
                source = args.photos / photo["file"]
                if source.resolve() != args.photos.resolve() / photo["file"]:
                    raise ValueError
                with source.open("rb") as image_file:
                    data = image_file.read(10 * 1024**2 + 1)
                if len(data) > 10 * 1024**2 or sha256(data).hexdigest() != photo["sha256"]:
                    raise ValueError
                with Image.open(io.BytesIO(data), formats=["JPEG"]) as image:
                    if image.width * image.height > 20_000_000:
                        raise ValueError
                    rgb = image.convert("RGB")
                if photo.get("rotateClockwise", False):
                    rgb = rgb.transpose(Image.Transpose.ROTATE_270)
                stage = "SALAD_INFERENCE"
                vector = model(transform(rgb).unsqueeze(0)).flatten()
                if vector.shape != (8448,) or not torch.isfinite(vector).all() or vector.norm() == 0:
                    raise ValueError
                descriptors[photo["sha256"]] = vector.tolist()
                times.append((perf_counter() - start) * 1000)

        stage = "SALAD_OUTPUT"
        report = {
            "version": "salad-v1.0.0",
            "modelSha256": MODEL_SHA,
            "manifestSha256": args.manifest_sha256,
            "descriptors": descriptors,
        }
        with TemporaryDirectory(dir=args.output.parent) as temp:
            partial = Path(temp) / "descriptors.json"
            partial.write_text(json.dumps(report, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
            partial.replace(args.output)
        print(json.dumps({
            "images": len(times),
            "meanMillis": round(sum(times) / len(times), 2),
            "maximumMillis": round(max(times), 2),
        }))
        emit("COMPLETE", "SALAD_OUTPUT", correlation, "complete")
        return 0
    except KeyboardInterrupt:
        emit("CANCELLED", stage, correlation, "skipped")
        return 130
    except Exception:
        emit(stage, stage, correlation, "unchanged")
        return 2


if __name__ == "__main__":
    sys.exit(main())
