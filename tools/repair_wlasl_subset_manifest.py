"""Rebuild a WLASL subset manifest from downloaded class directories."""

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", default=".tmp-wlasl/start_kit/WLASL_v0.3.json")
    parser.add_argument("--output", default="data/wlasl_subset")
    parser.add_argument("--classes", nargs="+", required=True)
    args = parser.parse_args()

    root = Path(args.output)
    wanted = {label.lower() for label in args.classes}
    metadata = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
    entries = []
    for item in metadata:
        label = item["gloss"].lower()
        if label not in wanted:
            continue
        class_dir = root / label.replace(" ", "_")
        for instance in item["instances"]:
            path = class_dir / f"{instance['video_id']}.mp4"
            if path.exists() and path.stat().st_size > 1024:
                entries.append(
                    {
                        "path": str(path.resolve()),
                        "label": label,
                        "split": instance.get("split", "train"),
                    }
                )

    manifest = root / "manifest.json"
    manifest.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    print(f"manifest_entries={len(entries)}")
    for label in sorted({entry["label"] for entry in entries}):
        print(f"{label}={sum(entry['label'] == label for entry in entries)}")
    print(f"output={manifest}")


if __name__ == "__main__":
    main()