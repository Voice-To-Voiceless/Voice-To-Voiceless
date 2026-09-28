"""Export the pinned L2CS SafeTensors checkpoint to browser-compatible ONNX.

Run with:
  uv run --project app --group model-tools python app/scripts/export_l2cs_onnx.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from safetensors.torch import load_file
from torchvision.models import resnet50


class L2CSModel(torch.nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.backbone = resnet50(weights=None)
        self.backbone.fc = torch.nn.Identity()
        self.fc_pitch_gaze = torch.nn.Linear(2048, 90)
        self.fc_yaw_gaze = torch.nn.Linear(2048, 90)

    def forward(self, images: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        features = self.backbone(images)
        # Keep the exported order explicit: yaw first, pitch second.
        return self.fc_yaw_gaze(features), self.fc_pitch_gaze(features)


INPUT_SIZE = 448


def load_model(weights: Path) -> L2CSModel:
    model = L2CSModel()
    state = load_file(str(weights), device="cpu")
    model.backbone.load_state_dict({key: value for key, value in state.items() if not key.startswith("fc_")}, strict=True)
    model.fc_pitch_gaze.load_state_dict({key.removeprefix("fc_pitch_gaze."): value for key, value in state.items() if key.startswith("fc_pitch_gaze.")}, strict=True)
    model.fc_yaw_gaze.load_state_dict({key.removeprefix("fc_yaw_gaze."): value for key, value in state.items() if key.startswith("fc_yaw_gaze.")}, strict=True)
    return model.eval()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fixed_inputs() -> list[np.ndarray]:
    rng = np.random.default_rng(20260928)
    return [
        np.zeros((1, 3, INPUT_SIZE, INPUT_SIZE), dtype=np.float32),
        np.full((1, 3, INPUT_SIZE, INPUT_SIZE), 0.5, dtype=np.float32),
        rng.standard_normal((1, 3, INPUT_SIZE, INPUT_SIZE), dtype=np.float32),
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, default=Path("app/frontend/public/models/l2cs_gaze360_resnet50.safetensors"))
    parser.add_argument("--output", type=Path, default=Path("app/frontend/public/models/l2cs_gaze360_resnet50.onnx"))
    parser.add_argument("--parity-dir", type=Path, help="Optional directory of fixed PNG/JPEG face crops for parity validation.")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    model = load_model(args.weights)
    example = torch.zeros((1, 3, INPUT_SIZE, INPUT_SIZE), dtype=torch.float32)
    torch.onnx.export(
        model,
        (example,),
        str(args.output),
        input_names=["images"],
        output_names=["yaw_logits", "pitch_logits"],
        dynamic_axes={"images": {0: "batch"}, "yaw_logits": {0: "batch"}, "pitch_logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )

    session = ort.InferenceSession(str(args.output), providers=["CPUExecutionProvider"])
    max_abs = 0.0
    parity_inputs = load_parity_images(args.parity_dir) if args.parity_dir else fixed_inputs()
    for inputs in parity_inputs:
        with torch.inference_mode():
            torch_outputs = model(torch.from_numpy(inputs))
        onnx_outputs = session.run(["yaw_logits", "pitch_logits"], {"images": inputs})
        max_abs = max(max_abs, *(float(np.max(np.abs(torch_output.numpy() - onnx_output))) for torch_output, onnx_output in zip(torch_outputs, onnx_outputs)))
    if max_abs > 1e-4:
        raise RuntimeError(f"PyTorch/ONNX parity failed: max absolute error {max_abs}")

    manifest = {
        "model": "L2CS-Net ResNet-50 Gaze360",
        "input": {"name": "images", "shape": [1, 3, INPUT_SIZE, INPUT_SIZE], "layout": "NCHW", "color": "RGB", "dtype": "float32", "resize": [INPUT_SIZE, INPUT_SIZE], "normalization": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]}, "horizontal_flip": False},
        "outputs": [{"name": "yaw_logits", "axis": "yaw"}, {"name": "pitch_logits", "axis": "pitch"}],
        "decoding": {"bins": 90, "degrees_per_bin": 4, "minimum_degrees": -180, "formula": "sum(softmax(logits) * arange(90)) * 4 - 180", "output_unit": "degrees"},
        "provenance": {"checkpoint": "py-feat re-host of official L2CS-Net Gaze360 weights", "source": "https://github.com/Ahmednull/L2CS-Net", "weights_sha256": sha256(args.weights)},
        "onnx_sha256": sha256(args.output),
        "parity": {"fixture": str(args.parity_dir) if args.parity_dir else "deterministic zero/constant/seeded tensors", "sample_count": len(parity_inputs), "max_abs_error": max_abs, "tolerance": 1e-4},
    }
    args.output.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"onnx": str(args.output), "manifest": str(args.output.with_suffix('.manifest.json')), "max_abs_error": max_abs}, indent=2))


def load_parity_images(directory: Path) -> list[np.ndarray]:
    images = sorted(path for path in directory.iterdir() if path.suffix.lower() in {".png", ".jpg", ".jpeg"})
    if not images:
        raise ValueError(f"No PNG/JPEG parity images found in {directory}")
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    result = []
    for path in images:
        image = np.asarray(Image.open(path).convert("RGB").resize((INPUT_SIZE, INPUT_SIZE)), dtype=np.float32) / 255.0
        result.append(((image - mean) / std).transpose(2, 0, 1)[None, ...].astype(np.float32))
    return result


if __name__ == "__main__":
    main()
