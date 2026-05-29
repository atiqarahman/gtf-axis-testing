#!/usr/bin/env python3
"""Score AR's official v8.3 25-product spot-check.

This script is deterministic: it reads extraction JSON and compares known failure
checks from the May 29 spot-check PDF. It does not call any LLM.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path.home() / ".openclaw/workspace/gtf-review/v83-implementation"


SKU_ALIASES = {
    "ANITA chocolate": ["GTF-TOD-011010099510ONESIZE1", "01-1010-099-510-one-size-1-"],
    "ANITA lemon": ["GTF-TOD-011010099170ONESIZE1", "01-1010-099-170-one-size-1-"],
    "SHANTY chocolate": ["GTF-TOD-001020009510SM", "00-1020-009-510-S/M-", "GTF-TOD-031020043510SM", "03-1020-043-510-s-m-"],
    "SHANTY olive": ["GTF-TOD-001020009420SM", "00-1020-009-420-S/M-"],
    "KASSIA gold": ["GTF-TOD-032011031148XSSPETITE", "03-2011-031-148-xs-s-petite"],
    "IREN cardigan": ["GTF-TOD-021050480660ONESIZE1PETITE", "02-1050-480-660-one-size-1-petite"],
    "LEO cream": ["GTF-TOD-031210018040XSSPETITE", "03-1210-018-040-xs-s-petite"],
    "FLORENCE black": ["GTF-TOD-032011032690XSSPETITE", "03-2011-032-690-xs-s-petite"],
    "SAINTTROPEZ dress": ["GTF-TOD-021010139510ONESIZE1PETITE", "02-1010-139-510-one-size-1-petite"],
}

CHECKS = [
    {"n": 1, "sku": "AP/AP25/039", "label": "Olive Beaded Embroidered Top", "field": "secondary_color", "expected_any": ["fuchsia", "pink"], "category": "Secondary color detection"},
    {"n": 2, "sku": "AP/AP25/021", "label": "Fuchsia Print Chantilly Dress", "field": "secondary_color", "expected_any": ["black"], "category": "Secondary color detection"},
    {"n": 3, "sku": "AP/AP25/041", "label": "Olive Baroque Sheath Dress", "field": "secondary_color", "expected_any": ["gold", "bronze"], "category": "Secondary color detection"},
    {"n": 4, "sku": "ANITA chocolate", "label": "ANITA Dress Chocolate", "field": "secondary_color", "expected_any": ["gold"], "category": "Secondary color detection"},
    {"n": 5, "sku": "AP/AP25/034", "label": "Canary Beaded Bodysuit", "field": "material_primary", "expected_any": ["tulle", "mesh"], "category": "Material not embellishment"},
    {"n": 6, "sku": "AP/AP25/029", "label": "Beige Sequins Kimono Dress", "field": "material_primary", "expected_any": ["tulle", "silk"], "category": "Material not embellishment"},
    {"n": 7, "sku": "AP/AP25/030", "label": "Brown Pleated Dress & Cape", "field": "material_primary", "expected_any": ["chiffon", "silk"], "category": "Material not embellishment"},
    {"n": 8, "sku": "AP/AP25/021", "label": "Fuchsia Print Dress", "field": "pattern", "expected_any": ["floral"], "category": "Pattern specificity"},
    {"n": 9, "sku": "AP/AP25/036", "label": "Indigo Swirl Skirt", "field": "pattern", "expected_any": ["swirl", "abstract"], "category": "Pattern specificity"},
    {"n": 10, "sku": "AP/AP25/052", "label": "Indigo Pleated Pants", "field": "pattern", "expected_any": ["swirl"], "category": "Pattern specificity"},
    {"n": 11, "sku": "SHANTY chocolate", "label": "SHANTY Jumper Chocolate", "field": "pattern", "expected_any": ["cable"], "category": "Cable vs ribbed"},
    {"n": 12, "sku": "SHANTY olive", "label": "SHANTY Jumper Olive", "field": "pattern", "expected_any": ["cable"], "category": "Cable vs ribbed"},
    {"n": 13, "sku": "KASSIA gold", "label": "KASSIA Wrap Dress", "field": "details", "expected_any": ["belted"], "hard_gate": True, "category": "Normalizer fixes"},
    {"n": 14, "sku": "IREN cardigan", "label": "IREN Cardigan Ardesia", "field": "material_secondary", "expected_any": ["lurex"], "hard_gate": True, "category": "Normalizer fixes"},
    {"n": 15, "sku": "AP/AP25/033", "label": "Dark Brown Pinstriped Pants", "field": "silhouette", "expected_any": ["wide-leg"], "hard_gate": True, "category": "Normalizer fixes"},
    {"n": 16, "sku": "AP/AP25/036", "label": "Indigo Swirl Skirt", "field": "silhouette", "expected_any": ["a-line", "flared"], "category": "Silhouette accuracy"},
    {"n": 17, "sku": "LEO cream", "label": "LEO Trousers Cream", "field": "silhouette", "expected_any": ["tailored"], "category": "Silhouette accuracy"},
    {"n": 18, "sku": "FLORENCE black", "label": "FLORENCE Mesh Gown", "field": "silhouette", "expected_any": ["mermaid", "trumpet"], "category": "Silhouette accuracy"},
    {"n": 19, "sku": "AP/AP25/024", "label": "Indigo Hemp Denim Pants", "field": "details", "expected_any": ["topstitched"], "category": "Details completeness"},
    {"n": 20, "sku": "AP/AP25/036", "label": "Indigo Swirl Skirt", "field": "details", "expected_any": ["high-slit", "front-slit", "ruffled"], "category": "Details completeness"},
    {"n": 21, "sku": "SAINTTROPEZ dress", "label": "SAINTTROPEZ Dress Chocolate", "field": "details", "expected_any": ["gold-hardware", "spaghetti-strap"], "category": "Details completeness"},
    {"n": 22, "sku": "IREN cardigan", "label": "IREN Cardigan", "field": "primary_color", "expected_any": ["charcoal", "stone"], "category": "Color naming"},
    {"n": 23, "sku": "ANITA lemon", "label": "ANITA Dress Lemon", "field": "primary_color", "expected_any": ["sage", "pistachio"], "category": "Color naming"},
    {"n": 24, "sku": "AP/AP25/003", "label": "Hemp Denim Pantsuit", "field": "top_level_inheritance", "expected_any": ["lapel", "long"], "category": "Multi-piece inheritance"},
    {"n": 25, "sku": "AP/AP25/037", "label": "Indigo Bolero Jacket", "field": "category", "expected_any": ["bolero"], "category": "Category product name wins"},
]


def norm(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, dict):
        return norm(v.get("value") or v.get("label") or v.get("canonical") or v)
    if isinstance(v, list):
        return " ".join(norm(x) for x in v)
    return str(v).lower().replace("_", "-").strip()


def hard_attrs(ex: dict[str, Any]) -> dict[str, Any]:
    return ex.get("hard_attributes") or ex.get("attributes") or {}


def field_value(ex: dict[str, Any], field: str) -> str:
    ha = hard_attrs(ex)
    if field == "top_level_inheritance":
        return " ".join([norm(ha.get("neckline")), norm(ha.get("sleeve_length"))])
    if field in {"category", "brand_category"}:
        return " ".join([norm(ha.get("category")), norm(ex.get("category")), norm(ex.get("brand_category"))])
    return norm(ha.get(field) or ex.get(field))


def load_extractions(paths: list[Path]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for path in paths:
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "items" in data:
            data = data["items"]
        if isinstance(data, dict) and "extractions" in data:
            data = data["extractions"]
        if isinstance(data, list):
            out.extend(x for x in data if isinstance(x, dict))
    return out


def key_candidates(ex: dict[str, Any]) -> set[str]:
    vals = [ex.get("brand_sku"), ex.get("gtf_sku"), ex.get("product_id"), ex.get("product_name")]
    return {str(v).strip() for v in vals if v}


def product_blob(ex: dict[str, Any]) -> str:
    vals = [ex.get("brand_sku"), ex.get("gtf_sku"), ex.get("product_id"), ex.get("product_name"), ex.get("color"), ex.get("brand_category")]
    st = ex.get("source_truth") or {}
    if isinstance(st, dict):
        vals.extend([st.get("run_id"), st.get("final_primary_image"), st.get("final_secondary_image")])
    return norm(" ".join(str(v) for v in vals if v))


def matches_check(ex: dict[str, Any], check: dict[str, Any]) -> bool:
    keys = key_candidates(ex)
    aliases = SKU_ALIASES.get(check["sku"], [])
    if check["sku"] in keys or check["label"] in keys or any(a in keys for a in aliases):
        return True
    blob = product_blob(ex)
    sku = norm(check["sku"])
    label = norm(check["label"])
    if sku and sku in blob:
        return True
    for alias in SKU_ALIASES.get(check["sku"], []):
        if norm(alias) in blob:
            return True
    # TOD checks often arrive as product name + colour rather than AR shorthand.
    meaningful = [t for t in re.split(r"[^a-z0-9]+", label) if len(t) > 2]
    return bool(meaningful) and all(t in blob for t in meaningful[:3])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extractions", nargs="*", type=Path, default=[ROOT / "public/data/tod/tod_extractions_v8_3.json", OUT_DIR / "afropop_v83_spotcheck_extractions.json"])
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    extractions = load_extractions(args.extractions)
    rows = []
    pass_count = 0
    hard_gate_failures = []
    for check in CHECKS:
        match = None
        for ex in extractions:
            if matches_check(ex, check):
                match = ex
                break
        actual = field_value(match, check["field"]) if match else ""
        expected = check["expected_any"]
        passed = bool(match) and any(e in actual for e in expected)
        verdict = "PASS" if passed else "FAIL"
        if passed:
            pass_count += 1
        elif check.get("hard_gate"):
            hard_gate_failures.append(check["sku"])
        rows.append({**check, "expected": " / ".join(expected), "actual": actual or "MISSING_EXTRACTION", "verdict": verdict})

    csv_path = args.out_dir / "v83_spotcheck_results.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["n", "sku", "label", "category", "field", "expected", "actual", "verdict", "hard_gate"])
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in writer.fieldnames})

    aggregate = "PASS" if pass_count >= 20 and not hard_gate_failures else "PATCH_FAILED_ONLY" if pass_count >= 15 else "MAJOR_REWORK"
    md = [
        "# GTF v8.3 25-Product Spot-Check Results",
        "",
        f"Score: **{pass_count}/25**",
        f"Hard gate failures: **{', '.join(hard_gate_failures) if hard_gate_failures else 'none'}**",
        f"Recommendation: **{aggregate}**",
        "",
        "| # | SKU | Category | Field | Expected | Actual | Verdict |",
        "|---:|---|---|---|---|---|---|",
    ]
    for r in rows:
        md.append(f"| {r['n']} | `{r['sku']}` | {r['category']} | `{r['field']}` | {r['expected']} | {r['actual']} | **{r['verdict']}** |")
    (args.out_dir / "V83_25_PRODUCT_SPOTCHECK_RESULTS.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"score={pass_count}/25 recommendation={aggregate} csv={csv_path}")
    return 0 if aggregate == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
