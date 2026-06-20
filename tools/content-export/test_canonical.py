"""Self-test for canonical.py. Run: python tools/content-export/test_canonical.py
Asserts: SHA-256 KAT, JS-parity number formatting over the supported range, and loud failure outside it."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from canonical import js_number_str, content_hash  # noqa
import hashlib


def main():
    # SHA-256 known-answer (stdlib hashlib)
    assert hashlib.sha256(b"abc").hexdigest() == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

    # JS String(Number) parity over the supported (normal) range
    cases = {100: "100", 0: "0", -3: "-3", 92.5: "92.5", 2.5: "2.5", 33.33: "33.33",
             1000000: "1000000", 0.0001: "0.0001", 99.999: "99.999"}
    for v, expected in cases.items():
        got = js_number_str(v)
        assert got == expected, f"js_number_str({v!r})={got!r} != {expected!r}"

    # Loud failure outside the JS-parity range (would diverge from hash.ts) — must raise, never silently hash
    for bad in (1e-7, 1e21, 1e-5):
        try:
            js_number_str(bad)
            raise AssertionError(f"expected ValueError for {bad!r}")
        except ValueError:
            pass

    # content_hash determinism (order-independent over rows)
    schema_cols = ["id", "freq"]
    h1 = content_hash([{"id": "a", "freq": 1}, {"id": "b", "freq": 2.5}], schema_cols)
    h2 = content_hash([{"id": "b", "freq": 2.5}, {"id": "a", "freq": 1}], schema_cols)
    assert h1 == h2 and len(h1) == 64

    print("canonical.py self-test OK")


if __name__ == "__main__":
    main()
