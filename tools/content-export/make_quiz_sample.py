"""Generate a small, SELF-CONTAINED quiz sample pack for the app to bundle (PR #5).

The full quiz set (~4.5 MB) is too large to bundle unconditionally; bundling the whole set is a
deferred size/ops decision. This produces a deterministic, VERBATIM cross-section of real
`Quiz_Bank` rows so the runner has real content to exercise in dev/beta and integration tests.

Self-contained: the one hard FK on Quiz_Bank (`CalibrationProfileID -> Calibration_Report.ProfileID`)
is softened to a soft '(node)' link so the sample ingests standalone (no Calibration_Report needed).
Rows are copied verbatim — no fabrication, no edits. content_hash is recomputed with canonical.py
(byte-identical to the app's hash.ts) so the pack passes validate().

Run: python tools/content-export/make_quiz_sample.py
Out: apps/poker-mobile/assets/content/0.8.0/quiz_sample.pack.json
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from canonical import content_hash  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, "content", "release-0.8.0", "exports", "0.8.0", "packs", "quiz_bank.pack.json")
OUT = os.path.join(REPO, "apps", "poker-mobile", "assets", "content", "0.8.0", "quiz_sample.pack.json")

SAMPLE_SIZE = 30


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        pack = json.load(f)

    schema = [dict(c) for c in pack["schema"]]
    # Soften the single hard FK so the sample is self-contained (documented; sample only).
    for c in schema:
        if c.get("column") == "CalibrationProfileID" and c.get("fk") == "Calibration_Report.ProfileID":
            c["fk"] = "(node)"

    src_rows = pack["rows"]
    n = len(src_rows)
    take = min(SAMPLE_SIZE, n)
    # Deterministic evenly-spaced stride → a cross-section across categories (rows verbatim).
    stride = max(1, n // take)
    rows = [src_rows[i] for i in range(0, n, stride)][:take]

    columns = [c["column"] for c in schema]
    chash = content_hash(rows, columns)

    out = {
        "manifest": {
            "dataset_version": pack["manifest"]["dataset_version"],
            "pack_id": "quiz_sample",
            "source_sheet": "Quiz_Bank",
            "exported": pack["manifest"].get("exported"),
            "row_count": len(rows),
            "content_hash": chash,
            "verification_rollup": {},
            "marketable_as": "Educational",
        },
        "schema": schema,
        "rows": rows,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("wrote %s (%d rows, hash %s…)" % (os.path.relpath(OUT, REPO), len(rows), chash[:12]))


if __name__ == "__main__":
    main()
