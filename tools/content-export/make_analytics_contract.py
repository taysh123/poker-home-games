"""Generate the bundled analytics contract artifact for the app (PR #8 consumer).

Reads the exported Analytics_Events pack and writes a small `{ dataset_version, events }` JSON the app
bundles (src/analytics/contractStore.ts loads it, flag-gated). Verbatim rows — no fabrication. This
replaces the earlier manual copy step so the artifact is reproducible.

Run: python tools/content-export/make_analytics_contract.py
Out: apps/poker-mobile/assets/content/<dataset_version>/analytics_contract.json  (paths via paths.py)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from paths import WORKBOOK, exports_dir, assets_dir  # noqa: E402
from export import read_workbook, dataset_version  # noqa: E402

DSV = dataset_version(read_workbook(WORKBOOK))[0]
SRC = os.path.join(exports_dir(DSV), "packs", "analytics_events.pack.json")
OUT = os.path.join(assets_dir(DSV), "analytics_contract.json")


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        pack = json.load(f)

    out = {"dataset_version": pack["manifest"]["dataset_version"], "events": pack["rows"]}

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("wrote %s (%d events, dataset %s)" % (OUT, len(out["events"]), out["dataset_version"]))


if __name__ == "__main__":
    main()
