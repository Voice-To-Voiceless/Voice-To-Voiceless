"""Download only the WLASL clips needed by the communication board."""

import argparse
import json
import subprocess
import sys
from pathlib import Path

DEFAULT_CLASSES = (
    "hello",
    "thank you",
    "yes",
    "no",
    "help",
    "nervous",
    "water",
    "food",
    "bathroom",
    "emergency",
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", default=".tmp-wlasl/start_kit/WLASL_v0.3.json")
    parser.add_argument("--output", default="data/wlasl_subset")
    parser.add_argument("--max-per-class", type=int, default=10)
    parser.add_argument("--classes", nargs="+", default=DEFAULT_CLASSES)
    args = parser.parse_args()

    metadata = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
    wanted = {name.lower() for name in args.classes}
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    known_paths = {entry["path"] for entry in manifest}

    for entry in metadata:
        label = entry["gloss"].lower()
        if label not in wanted:
            continue
        instances = entry["instances"][: args.max_per_class]
        class_dir = output / label.replace(" ", "_")
        class_dir.mkdir(exist_ok=True)
        for instance in instances:
            video_id = instance["video_id"]
            target = class_dir / f"{video_id}.mp4"
            if target.exists() and str(target) not in known_paths and target.stat().st_size > 1024:
                manifest.append({"path": str(target), "label": label, "split": instance.get("split", "train")})
                known_paths.add(str(target))
                manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            if not target.exists():
                command = [
                    sys.executable,
                    "-m",
                    "yt_dlp",
                    "--no-playlist",
                    "--quiet",
                    "--no-warnings",
                    "--socket-timeout",
                    "8",
                    "--retries",
                    "1",
                    "--fragment-retries",
                    "1",
                    "-f",
                    "mp4/bestvideo[ext=mp4]+bestaudio/best",
                    "--merge-output-format",
                    "mp4",
                    "-o",
                    str(target),
                    instance["url"],
                ]
                try:
                    result = subprocess.run(command, check=False, timeout=15)
                except subprocess.TimeoutExpired:
                    print(f"TIMEOUT {label}: {video_id}", flush=True)
                    result = None
                if result is None or result.returncode != 0:
                    print(f"SKIP {label}: {video_id}", flush=True)
                    continue
                if str(target) not in known_paths:
                    manifest.append({"path": str(target), "label": label, "split": instance.get("split", "train")})
                    known_paths.add(str(target))
                    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            print(f"READY {label}: {video_id}", flush=True)
    print(f"Downloaded/available clips: {len(manifest)}")


if __name__ == "__main__":
    main()
