"""Record a small ASL vocabulary with the webcam for local fine-tuning."""

import argparse
import json
import time
from pathlib import Path

import cv2


def record_clip(camera: cv2.VideoCapture, output: Path, duration: float, fps: float) -> None:
    width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
    height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
    writer = cv2.VideoWriter(
        str(output),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )
    started = time.monotonic()
    while time.monotonic() - started < duration:
        success, frame = camera.read()
        if not success:
            continue
        writer.write(frame)
        cv2.imshow("ASL recorder", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            writer.release()
            raise KeyboardInterrupt
    writer.release()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--labels",
        default="hello,thank you,help,yes,no,please,sorry,goodbye",
        help="Comma-separated ASL labels to record",
    )
    parser.add_argument("--samples", type=int, default=30)
    parser.add_argument("--duration", type=float, default=3.0)
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--output", default="data/custom_asl")
    args = parser.parse_args()

    labels = [label.strip() for label in args.labels.split(",") if label.strip()]
    if len(labels) < 2:
        raise ValueError("At least two labels are required")

    root = Path(args.output)
    video_root = root / "videos"
    video_root.mkdir(parents=True, exist_ok=True)
    camera = cv2.VideoCapture(args.camera)
    if not camera.isOpened():
        raise RuntimeError("Could not open the webcam")
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    fps = camera.get(cv2.CAP_PROP_FPS)
    fps = fps if 1 <= fps <= 60 else 20
    entries = []

    try:
        for label in labels:
            label_dir = video_root / label.replace(" ", "_")
            label_dir.mkdir(parents=True, exist_ok=True)
            for sample in range(args.samples):
                print(f"Prepare sign '{label}' ({sample + 1}/{args.samples}). Press Enter to record or q to stop.")
                command = input()
                if command.lower() == "q":
                    raise KeyboardInterrupt
                time.sleep(1)
                output = label_dir / f"{sample:04d}.mp4"
                record_clip(camera, output, args.duration, fps)
                entries.append(
                    {
                        "label": label,
                        "split": "test" if sample % 5 == 0 else "train",
                        "path": str(output.resolve()),
                    }
                )
                print(f"Saved {output}")
    finally:
        camera.release()
        cv2.destroyAllWindows()

    manifest = root / "manifest.json"
    manifest.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    print(f"Recorded {len(entries)} clips")
    print(f"Manifest: {manifest}")


if __name__ == "__main__":
    main()