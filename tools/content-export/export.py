"""T Poker workbook exporter (the D2 bridge).

Reads TPoker_Content_Database.xlsx (workbook = single source of truth) and emits DETERMINISTIC production
JSON artifacts per the Export_Contract: one {manifest, schema, rows} pack per source sheet (schema from
Schema_Registry), plus coach_grounding.json and pack_manifests.json. No fabrication: VerificationTier and
labels are copied verbatim; only Published/Approved rows are exported. content_hash uses canonical.py
(byte-identical to the app's hash.ts). Stdlib only (no deps).

Usage:  python tools/content-export/export.py
Output: content/<release>/exports/<dataset_version>/  (release dir set in paths.py)
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from canonical import content_hash  # noqa: E402
from paths import WORKBOOK, exports_dir  # noqa: E402  (single source for the canonical release path)
M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PR = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": M, "r": R, "pr": PR}
EXPORTABLE_STATUS = {"Published", "Approved"}


def read_workbook(path):
    """Return {sheet_name: [row_dict,...]} with header->cell strings."""
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % M)))
    rels = {}
    for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall("pr:Relationship", NS):
        rels[rel.get("Id")] = rel.get("Target")
    sheets = []
    for s in ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS).findall("m:sheet", NS):
        tgt = rels.get(s.get("{%s}id" % R), "")
        tgt = ("xl/" + tgt) if tgt and not tgt.startswith("/") else tgt.lstrip("/")
        sheets.append((s.get("name"), tgt))

    def cv(c):
        t = c.get("t")
        v = c.find("m:v", NS)
        if t == "s":
            return shared[int(v.text)] if v is not None and v.text else ""
        if t == "inlineStr":
            i = c.find("m:is", NS)
            return "".join(x.text or "" for x in i.iter()) if i is not None else ""
        return v.text if v is not None else ""

    out = {}
    for name, path_ in sheets:
        root = ET.fromstring(z.read(path_))
        sd = root.find("m:sheetData", NS)
        rows_xml = sd.findall("m:row", NS) if sd is not None else []
        if not rows_xml:
            out[name] = []
            continue

        def row_cells(r):
            d = {}
            for c in r.findall("m:c", NS):
                d[re.match(r"[A-Z]+", c.get("r")).group(0)] = cv(c)
            return d
        header = row_cells(rows_xml[0])
        letters = sorted(header.keys(), key=lambda L: (len(L), L))
        names = [header[L] for L in letters]
        recs = []
        for r in rows_xml[1:]:
            cells = row_cells(r)
            recs.append({nm: cells.get(L, "") for L, nm in zip(letters, names) if nm})
        out[name] = recs
    return out


def norm_type(dt):
    d = (dt or "").strip().lower()
    if "int" in d:
        return "int"
    if any(k in d for k in ("num", "real", "float", "decimal")):
        return "number"
    if "bool" in d:
        return "bool"
    return "string"


def convert(cell, t):
    if cell is None or cell == "":
        return None
    try:
        if t == "int":
            return int(float(cell))
        if t == "number":
            return float(cell)
        if t == "bool":
            return True if str(cell) in ("Yes", "true", "TRUE", "1") else False if str(cell) in ("No", "false", "FALSE", "0") else str(cell)
    except (ValueError, TypeError):
        return str(cell)
    return str(cell)


def schema_registry(wb):
    """{sheet: [ {column, datatype, allowed, required, fk}, ... in order ]}"""
    by_sheet = {}
    for r in wb.get("Schema_Registry", []):
        sheet = r.get("Sheet")
        if not sheet:
            continue
        allowed_raw = (r.get("AllowedValues") or "").strip()
        allowed = [a.strip() for a in allowed_raw.split("|") if a.strip()] if allowed_raw else None
        by_sheet.setdefault(sheet, []).append({
            "column": r.get("Column"),
            "datatype": norm_type(r.get("DataType")),
            "allowed": allowed,
            "required": (r.get("Required") or "").strip(),
            "fk": (r.get("ForeignKeyTarget") or "").strip() or None,
        })
    return by_sheet


def snake(name):
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name).replace("-", "_").replace(" ", "_").lower()


def dataset_version(wb):
    rows = wb.get("Dataset_Versions", [])
    released = [r for r in rows if (r.get("Status") == "Released")] or rows
    if not released:
        return "0.0.0", ""
    last = released[-1]
    return last.get("SemVer", "0.0.0"), last.get("ReleaseDate", "")


def marketable_from_rollup(rollup, total):
    if total == 0:
        return "Educational"
    verified_nash = rollup.get("Nash-Solved", 0) + rollup.get("Solver-Verified", 0)
    if verified_nash / total >= 0.95:
        return "GTO / Verified-ready"
    if rollup.get("Calibrated", 0) > 0:
        return "Expert Calibrated"
    return "Educational"


def validate_pack(pack):
    """Mirror of the app validate.ts rules (enum/required/Solver-Verified/hash)."""
    errors = []
    schema, rows, manifest = pack["schema"], pack["rows"], pack["manifest"]
    cols = {c["column"]: c for c in schema}
    for i, row in enumerate(rows):
        for c in schema:
            v = row.get(c["column"])
            if c.get("required") == "Y" and (v is None or v == ""):
                errors.append(f"row {i}: required '{c['column']}' empty")
            if c.get("allowed") and v is not None and v != "" and str(v) not in c["allowed"]:
                errors.append(f"row {i}: '{c['column']}'='{v}' not in allowed")
        if "VerificationTier" in cols and "SolveConfigID" in cols:
            if row.get("VerificationTier") == "Solver-Verified" and not row.get("SolveConfigID"):
                errors.append(f"row {i}: Solver-Verified without SolveConfigID")
    if content_hash(rows, [c["column"] for c in schema]) != manifest["content_hash"]:
        errors.append("content_hash mismatch")
    return errors


def build_pack(sheet, schema, rows, dsv, release_date):
    cols = [c["column"] for c in schema]
    typed = []
    for r in rows:
        if "Status" in r and r.get("Status") not in EXPORTABLE_STATUS and r.get("Status"):
            continue
        typed.append({c["column"]: convert(r.get(c["column"]), c["datatype"]) for c in schema})
    pk = next((c["column"] for c in cols_pk_candidates(cols)), cols[0] if cols else None)
    if pk:
        typed.sort(key=lambda x: str(x.get(pk)))
    rollup = {}
    if "VerificationTier" in cols:
        for r in typed:
            t = r.get("VerificationTier")
            if t:
                rollup[t] = rollup.get(t, 0) + 1
    ch = content_hash(typed, cols)
    return {
        "manifest": {
            "dataset_version": dsv,
            "pack_id": snake(sheet),
            "source_sheet": sheet,
            "exported": release_date,
            "row_count": len(typed),
            "content_hash": ch,
            "verification_rollup": rollup,
            "marketable_as": marketable_from_rollup(rollup, len(typed)),
        },
        "schema": [{"column": c["column"], "datatype": c["datatype"], "allowed": c["allowed"], "required": c["required"], "fk": c["fk"]} for c in schema],
        "rows": typed,
    }


def cols_pk_candidates(cols):
    yield from ({"column": c} for c in cols if c == "RowID")
    yield from ({"column": c} for c in cols if c.endswith("ID"))


def build_coach_grounding(wb, dsv):
    claims = []
    for r in wb.get("Coach_Grounding", []):
        ev = (r.get("EvidenceNodeIDs") or "").strip()
        claims.append({
            "grounding_id": r.get("GroundingID"),
            "concept_id": r.get("ConceptID"),
            "claim_text": r.get("ClaimText"),
            "numeric_value": convert(r.get("NumericValue"), "number"),
            "unit": r.get("Unit") or None,
            "evidence_node_ids": [x.strip() for x in re.split(r"[;,]", ev) if x.strip()],
            "evidence_sheet": r.get("EvidenceSheet") or None,
            "verification_tier": r.get("VerificationTier"),
            "confidence_level": r.get("ConfidenceLevel") or None,
            "confidence_score": convert(r.get("ConfidenceScore"), "number"),
            "evidence_count": convert(r.get("EvidenceCount"), "int"),
            "citation": r.get("Citation") or None,
            "assertion_template": r.get("AssertionTemplate"),
            "grounding_type": r.get("GroundingType") or None,
            "safe_to_assert": str(r.get("SafeToAssert")) == "Yes",
        })
    claims.sort(key=lambda c: str(c.get("grounding_id")))
    return {"dataset_version": dsv, "claims": claims}


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def main():
    if not os.path.exists(WORKBOOK):
        print("ERROR: workbook not found at", WORKBOOK)
        sys.exit(1)
    wb = read_workbook(WORKBOOK)
    dsv, release_date = dataset_version(wb)
    schemas = schema_registry(wb)
    out_dir = exports_dir(dsv)
    packs_dir = os.path.join(out_dir, "packs")
    os.makedirs(packs_dir, exist_ok=True)

    index = {"dataset_version": dsv, "exported": release_date, "packs": [], "errors": []}
    SKIP = {"README", "Audit", "Schema_Registry"}  # docs / the registry itself
    for sheet in sorted(schemas.keys()):
        if sheet in SKIP:
            continue
        rows = wb.get(sheet, [])
        if not rows:
            continue
        pack = build_pack(sheet, schemas[sheet], rows, dsv, release_date)
        errs = validate_pack(pack)
        write_json(os.path.join(packs_dir, snake(sheet) + ".pack.json"), pack)
        index["packs"].append({"pack_id": pack["manifest"]["pack_id"], "source_sheet": sheet,
                               "row_count": pack["manifest"]["row_count"], "content_hash": pack["manifest"]["content_hash"],
                               "marketable_as": pack["manifest"]["marketable_as"], "errors": len(errs)})
        if errs:
            index["errors"].append({"sheet": sheet, "errors": errs[:10]})

    write_json(os.path.join(out_dir, "coach_grounding.json"), build_coach_grounding(wb, dsv))
    if wb.get("Pack_Manifests"):
        write_json(os.path.join(out_dir, "pack_manifests.json"), {"dataset_version": dsv, "manifests": wb["Pack_Manifests"]})
    index["packs"].sort(key=lambda p: p["pack_id"])
    write_json(os.path.join(out_dir, "index.json"), index)

    total_err = sum(p["errors"] for p in index["packs"])
    print(f"dataset_version={dsv}  packs={len(index['packs'])}  total_validation_errors={total_err}")
    print("output:", out_dir)
    for p in index["packs"]:
        print(f"  {p['pack_id']:34s} rows={p['row_count']:5d} err={p['errors']} {p['marketable_as']}")
    if total_err:
        print("VALIDATION ERRORS PRESENT — see index.json")
        sys.exit(2)
    print("ALL PACKS VALID")


if __name__ == "__main__":
    main()
