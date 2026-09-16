"""Download a small MS-ASL vocabulary from its public annotations."""

import argparse
import json
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", nargs="+", required=True)
    parser.add_argument("--output", default="data/msasl_subset")
    parser.add_argument("--max-per-class", type=int, default=12)
    parser.add_argument("--classes", nargs="+", default=["hello", "thank you", "help", "yes", "no", "please", "sorry"])
    args = parser.parse_args()

    records = []
    for metadata_path in args.metadata:
        records.extend(json.loads(Path(metadata_path).read_text(encoding="utf-8")))
    wanted = {label.lower() for label in args.classes}
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    known = {entry["path"] for entry in manifest}
    counts = {label: 0 for label in wanted}

    for record in records:
        label = record["clean_text"].strip().lower()
        if label not in wanted or counts[label] >= args.max_per_class:
            continue
        video_id = record["url"].split("v=")[-1].split("&")[0]
        target = output / label.replace(" ", "_") / f"{video_id}.mp4"
        target.parent.mkdir(parents=True, exist_ok=True)
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
                "mp4/best[ext=mp4]/best",
                "--merge-output-format",
                "mp4",
                "-o",
                str(target),
                record["url"],
            ]
            try:
                result = subprocess.run(command, check=False, timeout=20)
            except subprocess.TimeoutExpired:
                result = None
            if result is None or result.returncode != 0 or not target.exists() or target.stat().st_size < 1024:
                print(f"SKIP {label}: {video_id}", flush=True)
                continue
        relative = str(target)
        if relative not in known:
            manifest.append({"path": relative, "label": label, "split": "test" if counts[label] % 5 == 0 else "train"})
            known.add(relative)
            manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        counts[label] += 1
        print(f"READY {label}: {video_id}", flush=True)

    print(f"Downloaded/available clips: {len(manifest)}")
    print(json.dumps(counts, sort_keys=True))


if __name__ == "__main__":
    main()