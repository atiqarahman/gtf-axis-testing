#!/usr/bin/env python3
"""Prepare TOD Source Truth approved products for controlled Taste Lab ingestion.

This script deliberately does NOT fabricate GPT extraction outputs. Taste Lab review
requires v8.2 extraction payloads with axis_scores/hard_attributes. The output here is
the clean, audited Source Truth -> GPT extraction queue and exception ledger.
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def drive_view_to_thumbnail(url_or_path: str) -> str:
    """Return browser-friendly image URL/path without assuming public access."""
    if not url_or_path:
        return ""
    if url_or_path.startswith("/source-truth/drive-image/"):
        file_id = url_or_path.rsplit("/", 1)[-1]
        return f"https://drive.google.com/thumbnail?id={file_id}&sz=w1400"
    if "drive.google.com/uc?" in url_or_path and "id=" in url_or_path:
        file_id = url_or_path.split("id=", 1)[1].split("&", 1)[0]
        return f"https://drive.google.com/thumbnail?id={file_id}&sz=w1400"
    return url_or_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reviews", required=True, type=Path)
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--handoff", required=True, type=Path)
    parser.add_argument("--out", default=Path("public/data/tod"), type=Path)
    parser.add_argument("--report", default=Path("reports/TOD_SOURCE_TRUTH_TO_TASTE_LAB_AUDIT_MAY25.md"), type=Path)
    args = parser.parse_args()

    reviews_doc = load_json(args.reviews)
    run_doc = load_json(args.run)
    handoff_rows = load_json(args.handoff)

    reviews = reviews_doc["reviews"]
    run_products = run_doc["products"]
    run_by_sku = {p["gtf_sku"]: p for p in run_products}
    handoff_by_sku = {h["gtf_sku"]: h for h in handoff_rows}
    reviews_by_sku = {r["gtf_sku"]: r for r in reviews}

    duplicate_skus = [sku for sku, count in Counter(p["gtf_sku"] for p in run_products).items() if count > 1]
    duplicate_rows = [p for p in run_products if p["gtf_sku"] in duplicate_skus]

    approved: list[dict[str, Any]] = []
    exceptions: list[dict[str, Any]] = []

    for r in reviews:
        sku = r["gtf_sku"]
        row = run_by_sku.get(sku, {})
        handoff = handoff_by_sku.get(sku, {})
        status = r.get("local_review_status")
        has_primary = bool(r.get("curated_primary_image"))
        has_secondary = bool(r.get("curated_secondary_image"))
        if status == "approved" and has_primary and has_secondary:
            final_primary = r["curated_primary_image"]
            final_secondary = r["curated_secondary_image"]
            approved.append(
                {
                    "gtf_sku": sku,
                    "brand_sku": r.get("brand_sku"),
                    "product_name": r.get("product_name"),
                    "brand": "Try On Dress",
                    "brand_handle": row.get("brand_handle") or handoff.get("brand_handle") or "try-on-dress",
                    "brand_category": row.get("category") or handoff.get("brand_category") or handoff.get("category"),
                    "category": row.get("category") or handoff.get("category"),
                    "color": row.get("color"),
                    "material": row.get("material"),
                    "currency": row.get("currency"),
                    "price": None,
                    "size_price_map": row.get("size_price_map"),
                    "source_truth": {
                        "run_id": reviews_doc.get("run_id"),
                        "reviewer": r.get("reviewer"),
                        "reviewed_at": r.get("reviewed_at"),
                        "review_status": "approved",
                        "final_primary_image": final_primary,
                        "final_secondary_image": final_secondary,
                        "media_pipe_primary_image": r.get("media_pipe_primary_image"),
                        "media_pipe_secondary_image": r.get("media_pipe_secondary_image"),
                    },
                    "final_primary_image": final_primary,
                    "final_secondary_image": final_secondary,
                    "image_file": drive_view_to_thumbnail(final_primary),
                    "all_image_urls": handoff.get("all_image_urls") or [],
                    "source_row_indices": row.get("source_row_indices") or [],
                    "target_scope": "pending_v8_2_extraction",
                    "taste_lab_status": "ready_for_gpt_v8_2_extraction",
                    "can_enter_taste_lab_review": False,
                    "block_reason": "GPT v8.2 extraction not generated yet; do not fabricate axis/hard-attribute output.",
                }
            )
        else:
            exceptions.append(
                {
                    "source": "ar_export",
                    "status": status,
                    "gtf_sku": sku,
                    "brand_sku": r.get("brand_sku"),
                    "product_name": r.get("product_name"),
                    "has_curated_primary": has_primary,
                    "has_curated_secondary": has_secondary,
                    "run_image_candidates": len(row.get("image_candidates") or []),
                    "resolver_status": row.get("resolver_status"),
                    "resolver_reason": row.get("resolver_reason"),
                    "action": "exclude_from_taste_lab_until_AR_or_media_fix",
                }
            )

    for p in run_products:
        if p["gtf_sku"] not in reviews_by_sku:
            exceptions.append(
                {
                    "source": "missing_from_ar_export",
                    "status": "not_reviewed_zero_image_blocker",
                    "gtf_sku": p.get("gtf_sku"),
                    "brand_sku": p.get("brand_sku"),
                    "product_name": p.get("product_name"),
                    "has_curated_primary": False,
                    "has_curated_secondary": False,
                    "run_image_candidates": len(p.get("image_candidates") or []),
                    "resolver_status": p.get("resolver_status"),
                    "resolver_reason": p.get("resolver_reason"),
                    "action": "missing_media_ticket_for_Suman_Muskaan",
                }
            )

    extraction_queue = [
        {
            "gtf_sku": p["gtf_sku"],
            "brand_sku": p["brand_sku"],
            "product_name": p["product_name"],
            "brand": p["brand"],
            "brand_category": p["brand_category"],
            "category": p["category"],
            "color": p["color"],
            "material": p["material"],
            "source_truth_run_id": p["source_truth"]["run_id"],
            "source_truth_review_status": "approved",
            "final_primary_image": p["final_primary_image"],
            "final_secondary_image": p["final_secondary_image"],
            "all_image_urls": p["all_image_urls"],
            "required_extraction_version": "v8.2_or_v8.3_with_source_truth_contract",
            "hard_gate": "eligible_for_GPT_extraction_not_yet_Taste_Lab_reviewable",
        }
        for p in approved
    ]

    taste_lab_products = [
        {
            "product_id": p["gtf_sku"],
            "title": p["product_name"],
            "brand": "Try On Dress",
            "category": p["category"],
            "image_file": p["image_file"],
            "price": p["price"],
            "currency": p["currency"],
            "source_truth_run_id": p["source_truth"]["run_id"],
            "source_truth_review_status": "approved",
            "brand_sku": p["brand_sku"],
        }
        for p in approved
    ]

    args.out.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).isoformat()
    manifest = {
        "dataset": "TOD Source Truth -> Taste Lab controlled handoff",
        "run_id": reviews_doc.get("run_id"),
        "ar_exported_at": reviews_doc.get("exported_at"),
        "generated_at": generated_at,
        "counts": {
            "run_products_raw": len(run_products),
            "run_unique_gtf_skus": len(set(p["gtf_sku"] for p in run_products)),
            "ar_review_rows": len(reviews),
            "approved_for_gpt_extraction": len(approved),
            "blocked_exceptions": len(exceptions),
            "duplicate_sku_collision_rows": len(duplicate_rows),
        },
        "policy": {
            "taste_lab_reviewable_now": False,
            "reason": "Taste Lab needs real GPT v8.2/v8.3 extraction outputs. These 249 products are staged for GPT extraction first.",
            "do_not_do": "Do not create fake axis_scores or hard_attributes just to make the UI render.",
        },
        "files": {
            "approved_source_truth": "public/data/tod/tod_source_truth_approved_249.json",
            "gpt_extraction_queue": "public/data/tod/tod_v82_extraction_input_queue_249.json",
            "taste_lab_products_pending_extraction": "public/data/tod/tod_taste_lab_products_pending_extraction_249.json",
            "exceptions": "public/data/tod/tod_source_truth_exceptions_18.json",
            "exceptions_csv": "public/data/tod/tod_source_truth_exceptions_18.csv",
        },
    }

    (args.out / "tod_source_truth_approved_249.json").write_text(json.dumps({"manifest": manifest, "products": approved}, indent=2), encoding="utf-8")
    (args.out / "tod_v82_extraction_input_queue_249.json").write_text(json.dumps({"manifest": manifest, "items": extraction_queue}, indent=2), encoding="utf-8")
    (args.out / "tod_taste_lab_products_pending_extraction_249.json").write_text(json.dumps(taste_lab_products, indent=2), encoding="utf-8")
    (args.out / "tod_source_truth_exceptions_18.json").write_text(json.dumps({"manifest": manifest, "exceptions": exceptions, "duplicate_sku_collision_rows": duplicate_rows}, indent=2), encoding="utf-8")
    (args.out / "tod_import_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with (args.out / "tod_source_truth_exceptions_18.csv").open("w", encoding="utf-8", newline="") as f:
        fields = ["source", "status", "gtf_sku", "brand_sku", "product_name", "has_curated_primary", "has_curated_secondary", "run_image_candidates", "resolver_status", "resolver_reason", "action"]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(exceptions)

    status_counts = Counter(r.get("local_review_status") for r in reviews)
    exception_action_counts = Counter(e["action"] for e in exceptions)
    report = f"""# TOD Source Truth → Taste Lab CTO Audit — May 25, 2026

## Verdict

**Controlled handoff complete.** 249 AR-approved TOD products have been staged for GPT v8.2/v8.3 extraction using the Source Truth contract. They are **not** marked Taste-Lab-reviewable yet because Taste Lab must review real extraction outputs, not fabricated placeholder axis scores.

## Inputs

- Source Truth run: `{reviews_doc.get('run_id')}`
- AR export timestamp: `{reviews_doc.get('exported_at')}`
- Generated at: `{generated_at}`
- AR review file: `{args.reviews}`
- Source Truth run file: `{args.run}`
- Downstream handoff file: `{args.handoff}`

## Counts

- Raw run rows: **{len(run_products)}**
- Unique GTF SKUs: **{len(set(p['gtf_sku'] for p in run_products))}**
- AR review rows: **{len(reviews)}**
- AR status counts: `{dict(status_counts)}`
- Approved with curated primary + secondary: **{len(approved)}**
- Blocked exceptions: **{len(exceptions)}**
- Duplicate normalized SKU collision rows: **{len(duplicate_rows)}**

## Output files

- `public/data/tod/tod_source_truth_approved_249.json`
- `public/data/tod/tod_v82_extraction_input_queue_249.json`
- `public/data/tod/tod_taste_lab_products_pending_extraction_249.json`
- `public/data/tod/tod_source_truth_exceptions_18.json`
- `public/data/tod/tod_source_truth_exceptions_18.csv`
- `public/data/tod/tod_import_manifest.json`

## Gate decision

### Allowed now

- Use `tod_v82_extraction_input_queue_249.json` to run GPT v8.2/v8.3 extraction.
- After extraction succeeds, merge generated extraction payloads into Taste Lab `products.json` + `extractions_v8_2.json` or a TOD-specific dataset loader.

### Blocked now

- Do not show these 249 as attribute/vibe reviewable in Taste Lab yet.
- Do not synthesize `axis_scores`, `hard_attributes`, or vibe scores.
- Do not include `sent_to_review`, `manual_fix`, missing-media, or duplicate-SKU collision rows in the clean extraction queue.

## Exception action counts

`{dict(exception_action_counts)}`

## Duplicate SKU collision

The raw TOD run has duplicate normalized SKU: `{', '.join(duplicate_skus) if duplicate_skus else 'none'}`.
This needs a SKU-normalization fix before production import, because two visually/color-distinct products can collapse into one product id.

## Next engineering step

Run extraction against the 249-item queue with the locked Source Truth contract:

```txt
Source Truth approved primary/secondary images → GPT v8.2/v8.3 extraction → Taste Lab review → vibe scoring/Search Lab
```

"""
    args.report.write_text(report, encoding="utf-8")

    print(json.dumps(manifest["counts"], indent=2))


if __name__ == "__main__":
    main()
