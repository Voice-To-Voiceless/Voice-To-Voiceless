"""Build a training manifest from the official WLASL metadata and raw videos."""

import argparse
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def url_video_id(url: str) -> str:
    parsed = urlparse(url)
    query_id = parse_qs(parsed.query).get("v", [""])[0]
    if query_id:
        return query_id
    return parsed.path.rstrip("/").split("/")[-1].rsplit(".", 1)[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", default=".tmp-wlasl/start_kit/WLASL_v0.3.json")
    parser.add_argument("--videos", default=".tmp-wlasl/start_kit/raw_videos")
    parser.add_argument("--output", default="data/wlasl_full/manifest.json")
    args = parser.parse_args()

    metadata = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
    video_dir = Path(args.videos)
    files = {}
    for path in video_dir.iterdir():
        if path.is_file():
            files.setdefault(path.stem, path)

    manifest = []
    for item in metadata:
        for instance in item["instances"]:
            candidates = (instance["video_id"], url_video_id(instance["url"]))
            video = next((files.get(candidate) for candidate in candidates if files.get(candidate)), None)
            if video:
                manifest.append(
                    {
                        "label": item["gloss"],
                        "split": instance["split"],
                        "path": str(video.resolve()),
                        "video_id": instance["video_id"],
                    }
                )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    labels = sorted({entry["label"] for entry in manifest})
    print(f"manifest_entries={len(manifest)}")
    print(f"classes={len(labels)}")
    print(f"output={output}")


if __name__ == "__main__":
    main()