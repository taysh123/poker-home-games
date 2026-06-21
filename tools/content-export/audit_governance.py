"""READ-ONLY governance audit of the workbook's enum columns.

Reuses the exporter's read functions to scan EVERY sheet/column that declares AllowedValues in
Schema_Registry and reports the distinct actual values that fall OUTSIDE the declared enum (with row
counts). Strictly read-only: it opens the workbook for reading and prints; it never writes to the
workbook, Schema_Registry, or any values.

Run: python tools/content-export/audit_governance.py
"""
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from export import read_workbook, schema_registry  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
WB = os.path.join(REPO, "content", "release-0.8.0", "TPoker_Content_Database.xlsx")


def main():
    wb = read_workbook(WB)
    reg = schema_registry(wb)

    findings = []
    for sheet, cols in reg.items():
        rows = wb.get(sheet, [])
        for c in cols:
            allowed = c.get("allowed")
            if not allowed:
                continue
            col = c["column"]
            offending = Counter()
            for r in rows:
                v = r.get(col)
                if v is None or v == "":
                    continue
                if str(v) not in allowed:
                    offending[str(v)] += 1
            if offending:
                findings.append({
                    "sheet": sheet,
                    "column": col,
                    "allowed": allowed,
                    "offending": dict(sorted(offending.items(), key=lambda kv: (-kv[1], kv[0]))),
                    "rows_scanned": len(rows),
                })

    findings.sort(key=lambda f: (f["sheet"], f["column"]))
    print(json.dumps({"workbook": os.path.relpath(WB, REPO), "findings": findings}, ensure_ascii=False, indent=2))
    print("\n== SUMMARY ==", file=sys.stderr)
    print("sheets affected: %d" % len({f["sheet"] for f in findings}), file=sys.stderr)
    print("sheet/column contradictions: %d" % len(findings), file=sys.stderr)


if __name__ == "__main__":
    main()
