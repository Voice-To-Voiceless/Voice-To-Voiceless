"""Fine-tune an I3D model on a WLASL manifest."""

import argparse
import json
import random
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

I3D_PATH = Path(".tmp-wlasl/code/I3D").resolve()
sys.path.insert(0, str(I3D_PATH))
from pytorch_i3d import InceptionI3d


class WlaslSubset(Dataset):
    def __init__(self, manifest_path: Path, labels: list[str], split: str, frames: int = 64):
        entries = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.entries = [entry for entry in entries if entry["split"] == split and Path(entry["path"]).exists()]
        self.labels = labels
        self.label_ids = {label: index for index, label in enumerate(labels)}
        self.frames = frames

    def __len__(self) -> int:
        return len(self.entries)

    def __getitem__(self, index: int):
        entry = self.entries[index]
        capture = cv2.VideoCapture(entry["path"])
        total = max(1, int(capture.get(cv2.CAP_PROP_FRAME_COUNT)))
        indexes = np.linspace(0, max(0, total - 1), self.frames).astype(int)
        frames = []
        for frame_index in indexes:
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(frame_index))
            success, frame = capture.read()
            if not success:
                frame = np.zeros((224, 224, 3), dtype=np.uint8)
            height, width = frame.shape[:2]
            scale = 224 / min(height, width)
            resized = cv2.resize(frame, (round(width * scale), round(height * scale)))
            top = max(0, (resized.shape[0] - 224) // 2)
            left = max(0, (resized.shape[1] - 224) // 2)
            frames.append(resized[top:top + 224, left:left + 224])
        capture.release()
        video = np.asarray(frames, dtype=np.float32) / 127.5 - 1.0
        tensor = torch.from_numpy(video).permute(3, 0, 1, 2)
        return tensor, self.label_ids[entry["label"]]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/wlasl_full")
    parser.add_argument("--base-checkpoint", default="models/wlasl/asl2000.pt")
    parser.add_argument("--output", default="models/wlasl/wlasl_full.pt")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--learning-rate", type=float, default=0.0001)
    args = parser.parse_args()

    data_dir = Path(args.data)
    manifest_path = data_dir / "manifest.json"
    entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    labels = sorted({entry["label"] for entry in entries})
    if len(labels) < 2:
        raise RuntimeError("At least two downloaded classes are required")

    train_set = WlaslSubset(manifest_path, labels, "train")
    test_set = WlaslSubset(manifest_path, labels, "test")
    if not train_set or not test_set:
        raise RuntimeError("The manifest needs both train and test clips")

    model = InceptionI3d(400, in_channels=3)
    base_state = torch.load(args.base_checkpoint, map_location="cpu")
    model.replace_logits(len(labels))
    compatible = {
        key: value
        for key, value in base_state.items()
        if key in model.state_dict() and model.state_dict()[key].shape == value.shape
    }
    model.load_state_dict(compatible, strict=False)
    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in model.logits.parameters():
        parameter.requires_grad = True

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    optimizer = torch.optim.Adam(model.logits.parameters(), lr=args.learning_rate)
    loss_fn = nn.CrossEntropyLoss()
    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_set, batch_size=1, shuffle=False, num_workers=0)

    best_accuracy = 0.0
    for epoch in range(args.epochs):
        model.train()
        for videos, targets in train_loader:
            optimizer.zero_grad()
            logits = model(videos.to(device)).max(dim=2).values
            loss = loss_fn(logits, targets.to(device))
            loss.backward()
            optimizer.step()

        model.eval()
        correct = 0
        with torch.no_grad():
            for videos, targets in test_loader:
                prediction = model(videos.to(device)).max(dim=2).values.argmax(dim=1).cpu()
                correct += int((prediction == targets).sum())
        accuracy = correct / len(test_set)
        print(f"epoch={epoch + 1}/{args.epochs} validation_accuracy={accuracy:.3f}", flush=True)
        if accuracy >= best_accuracy:
            best_accuracy = accuracy
            Path(args.output).parent.mkdir(parents=True, exist_ok=True)
            torch.save(model.state_dict(), args.output)
            Path(args.output).with_suffix(".labels.txt").write_text("\n".join(labels) + "\n", encoding="utf-8")

    print(f"best_validation_accuracy={best_accuracy:.3f}")
    print(f"checkpoint={args.output}")


if __name__ == "__main__":
    main()
