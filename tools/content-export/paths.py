"""Shared paths for the content-export tools — the single place to retarget the canonical release.

Bump `RELEASE` here and every tool (export.py, make_quiz_sample.py, make_analytics_contract.py,
audit_governance.py) follows. Keeps the workbook path, exports dir, and bundled-assets dir DRY.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

# Canonical content release directory under content/. Bump this on a workbook version change.
RELEASE = "release-0.8.1"
RELEASE_DIR = os.path.join(REPO, "content", RELEASE)
WORKBOOK = os.path.join(RELEASE_DIR, "TPoker_Content_Database.xlsx")


def exports_dir(dataset_version):
    """content/<release>/exports/<dataset_version>/ — gitignored, reproducible."""
    return os.path.join(RELEASE_DIR, "exports", dataset_version)


def assets_dir(dataset_version):
    """apps/poker-mobile/assets/content/<dataset_version>/ — bundled app artifacts."""
    return os.path.join(REPO, "apps", "poker-mobile", "assets", "content", dataset_version)
