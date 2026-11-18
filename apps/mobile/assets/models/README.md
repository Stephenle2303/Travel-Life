# On-device landmark checkpoint

`dinov2-small-int8.onnx` is the int8 ONNX conversion of Meta's
[DINOv2 Small](https://huggingface.co/facebook/dinov2-small), distributed
under [Apache 2.0](DINOv2-LICENSE.txt). The exported model is from
[Xenova's pinned conversion](https://huggingface.co/Xenova/dinov2-small/blob/a5406bdfce9ac07eb3dc08dd05cbea034f4648d8/onnx/model_quantized.onnx).
Travel Life uses the conversion as published, without retraining.

SHA-256 `3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917`

The app only loads the model for opted-in, development-gated automatic
discovery. The separate [reference index](../../src/visual-place/data/LANDMARKS.md)
defines the pilot's recognizable places and source credits.
