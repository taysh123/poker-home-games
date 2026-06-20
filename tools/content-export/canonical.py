"""Canonical content hashing for the T Poker workbook exporter.

MUST stay byte-identical to apps/poker-mobile/src/content/hash.ts (pinned by a cross-language fixture:
tools/content-export/hash_fixture.json + the jest test src/content/__tests__/hashFixture.test.ts).

Recipe: values in schema-column order; null->\\x00; number->JS String(Number) form; bool->true/false;
string as-is; object/array->stable sorted-keys JSON; values joined by \\x1f; rows sorted; \\n-joined; SHA-256.
"""
import hashlib
import json

NULL = chr(0)
SEP = chr(31)


def js_number_str(x):
    """Mimic JavaScript String(Number(x)) — but ONLY over the range where Python's repr is provably
    byte-identical to V8 (plain decimal, |x| in [1e-6, 1e21), non-exponential). Outside that range JS
    switches to exponential with a different format, so we RAISE rather than silently emit a hash the app's
    hash.ts would reject. (No 0.8.0 value triggers this; it guards future extreme magnitudes.)"""
    f = float(x)
    if f == 0:
        return "0"
    a = abs(f)
    if a < 1e-6 or a >= 1e21:
        raise ValueError("number %r is outside the JS-parity range [1e-6, 1e21); cannot guarantee cross-language hash" % (x,))
    if f == int(f):
        return str(int(f))  # plain integer notation (matches JS up to 1e21)
    r = repr(f)             # shortest round-trip; matches JS in the plain-decimal range
    if "e" in r or "E" in r:
        raise ValueError("number %r formats with an exponent in Python (%s); not JS-String parity-safe" % (x, r))
    return r


def _stable_json(v):
    return json.dumps(v, sort_keys=True, separators=(",", ":"))


def encode_value(v):
    if v is None:
        return NULL
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return js_number_str(v)
    if isinstance(v, str):
        return v
    return _stable_json(v)


def canonical_row_body(rows, columns):
    lines = [SEP.join(encode_value(r.get(c)) for c in columns) for r in rows]
    lines.sort()
    return "\n".join(lines)


def content_hash(rows, columns):
    return hashlib.sha256(canonical_row_body(rows, columns).encode("utf-8")).hexdigest()
