#!/usr/bin/env python3
"""Run controlled TOD v8.2/v8.3 GPT extraction from Source Truth-approved queue.

Input: public/data/tod/tod_v82_extraction_input_queue_249.json
Output: public/data/tod/tod_extractions_v8_2.json + Taste Lab-ready products/extractions.

CTO guardrails:
- Only Source Truth approved rows are processed.
- Uses final primary + final secondary images.
- Checkpoints after every product.
- Does not process exception rows.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from PIL import Image

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

try:
    from openai import OpenAI
except Exception as exc:
    raise SystemExit(f"openai package missing: {exc}")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_QUEUE = ROOT / "public/data/tod/tod_v82_extraction_input_queue_249.json"
DEFAULT_OUT = ROOT / "public/data/tod/tod_extractions_v8_3.json"
DEFAULT_PRODUCTS_OUT = ROOT / "public/data/tod/tod_products_extracted_v8_3.json"
DEFAULT_REPORT = ROOT / "reports/TOD_V83_EXTRACTION_AUDIT_MAY29.md"
CACHE_DIR = ROOT / ".cache/tod_v82_images"
AXES = [
    "minimalism", "polish", "body_awareness", "drama", "novelty", "craft", "boldness",
    "glamour", "trend_currency", "styling_affordance", "cultural_richness",
]
VIBES = [
    "Old Money", "Glam", "Cool Girl", "Sexy Elegant", "Wedding Guest", "Dubai Glam",
    "Elevated City", "Winter Holidays", "Beach & Resort", "IT Girl",
    "Elevated Basics / Hailey Bieber", "Unique Finds",
]
SYSTEM_PROMPT = "You are GTF's catalog extraction engine. Return strict JSON only. No markdown."


def load_env() -> None:
    if load_dotenv:
        load_dotenv(ROOT / ".env")
        load_dotenv(ROOT / ".env.local")
        load_dotenv(Path("/Users/rahulkaushik/projects/fashion_finder_variants/flatlay_images_addon/.env"))
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY missing")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def thumb_url(path_or_url: str) -> str:
    if not path_or_url:
        return ""
    if path_or_url.startswith("/source-truth/drive-image/"):
        fid = path_or_url.rsplit("/", 1)[-1]
        return f"https://drive.google.com/thumbnail?id={fid}&sz=w1400"
    if "drive.google.com/uc?" in path_or_url and "id=" in path_or_url:
        fid = path_or_url.split("id=", 1)[1].split("&", 1)[0]
        return f"https://drive.google.com/thumbnail?id={fid}&sz=w1400"
    return path_or_url


def fetch_image_data_url(url: str, cache_key: str) -> str:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"{cache_key}.jpg"
    if cache_file.exists() and cache_file.stat().st_size > 1000:
        raw = cache_file.read_bytes()
    else:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        last_err: Exception | None = None
        for attempt in range(1, 5):
            try:
                with urlopen(req, timeout=35) as resp:
                    raw_in = resp.read()
                if len(raw_in) < 1000:
                    raise RuntimeError(f"image too small: {len(raw_in)}")
                img = Image.open(BytesIO(raw_in)).convert("RGB")
                img.thumbnail((1400, 1400))
                buf = BytesIO()
                img.save(buf, format="JPEG", quality=82, optimize=True)
                raw = buf.getvalue()
                cache_file.write_bytes(raw)
                break
            except Exception as exc:
                last_err = exc
                time.sleep(2 * attempt)
        else:
            raise RuntimeError(f"failed image fetch {url}: {last_err}")
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def category_scope(row: dict[str, Any]) -> str:
    text = f"{row.get('brand_category','')} {row.get('product_name','')}".lower()
    multi_words = ["set", "co-ord", "coord", "pantsuit", "suit", "with", " and ", "&", "+"]
    return "multi_piece_product" if any(w in text for w in multi_words) else "single_garment"


def build_prompt(row: dict[str, Any], guard: str, schema: dict[str, Any]) -> str:
    request = {
        "gtf_sku": row.get("gtf_sku"),
        "brand_sku": row.get("brand_sku"),
        "product_name": row.get("product_name"),
        "brand": row.get("brand", "Try On Dress"),
        "brand_category": row.get("brand_category"),
        "category": row.get("category"),
        "known_color_from_catalog": row.get("color"),
        "known_material_from_catalog": row.get("material"),
        "brand_price_tier": row.get("brand_price_tier") or row.get("price_tier") or "luxury",
        "source_truth_run_id": row.get("source_truth_run_id"),
        "source_truth_review_status": row.get("source_truth_review_status"),
        "final_primary_image": row.get("final_primary_image"),
        "final_secondary_image": row.get("final_secondary_image"),
        "target_scope_hint": category_scope(row),
    }
    requirements = {
        "must_return": [
            "product_id", "schema_version", "extraction_status", "brand_category", "target_scope",
            "source_truth", "hard_attributes", "axis_scores", "is_multi_piece", "component_count",
            "components", "search_terms", "suggested_vibes", "primary_vibe", "all_vibe_scores",
            "gpt_suggested_vibes", "product_tier", "review_needed", "manual_needed", "reasoning_trace", "meta",
        ],
        "axis_ids": AXES,
        "vibes": VIBES,
        "critical_tod_rules": [
            "Use brand_category/category as the target garment scope; do not extract visually dominant styling pieces.",
            "For bottoms, neckline and sleeve_length must be none.",
            "For accessories/snoods/palatines/cardigans, use category-appropriate none values instead of hallucinating dress anatomy.",
            "If unsure, mark field confidence lower and add review_needed; do not pretend certainty.",
            "Return only strict JSON.",
        ],
    }
    return (
        guard
        + "\n\nUse this schema intent. Preserve legacy Taste Lab fields as well as v8.2 additions.\n"
        + json.dumps(schema, ensure_ascii=False)[:14000]
        + "\n\nTOD EXTRACTION REQUEST:\n"
        + json.dumps(request, ensure_ascii=False, indent=2)
        + "\n\nOUTPUT REQUIREMENTS:\n"
        + json.dumps(requirements, ensure_ascii=False, indent=2)
    )


def ensure_defaults(row: dict[str, Any], ex: dict[str, Any], model: str, usage: Any = None) -> dict[str, Any]:
    ex.setdefault("product_id", row["gtf_sku"])
    ex.setdefault("gtf_sku", row["gtf_sku"])
    ex.setdefault("brand_sku", row["brand_sku"])
    ex.setdefault("product_name", row["product_name"])
    ex.setdefault("schema_version", "8.3")
    ex.setdefault("extraction_status", "ok")
    ex.setdefault("brand_category", row.get("brand_category") or row.get("category"))
    ex.setdefault("category", row.get("category") or row.get("brand_category"))
    ex.setdefault("target_scope", category_scope(row))
    ex.setdefault("source_truth", {
        "run_id": row.get("source_truth_run_id"),
        "review_status": row.get("source_truth_review_status"),
        "final_primary_image": row.get("final_primary_image"),
        "final_secondary_image": row.get("final_secondary_image"),
    })
    ex.setdefault("final_primary_image", row.get("final_primary_image"))
    ex.setdefault("final_secondary_image", row.get("final_secondary_image"))
    for list_key in ["components", "search_terms", "suggested_vibes", "gpt_suggested_vibes", "review_needed", "manual_needed"]:
        if not isinstance(ex.get(list_key), list):
            ex[list_key] = [] if ex.get(list_key) in (False, None, "") else [str(ex.get(list_key))]
    ex.setdefault("components", [])
    ex.setdefault("component_count", len(ex.get("components") or []))
    ex.setdefault("is_multi_piece", bool(ex.get("components")))
    ex.setdefault("search_terms", [])
    ex.setdefault("suggested_vibes", [])
    ex.setdefault("gpt_suggested_vibes", ex.get("suggested_vibes") or [])
    ex.setdefault("primary_vibe", (ex.get("suggested_vibes") or [""])[0] if ex.get("suggested_vibes") else "")
    ex.setdefault("all_vibe_scores", {})
    ex.setdefault("product_tier", "REVIEW")
    ex.setdefault("review_needed", [])
    ex.setdefault("manual_needed", [])
    ex.setdefault("reasoning_trace", {})
    ex.setdefault("meta", {})
    ex["meta"].update({
        "model": model,
        "source": "tod_v83_gpt_extraction",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "prompt_guard_version": "v8.3-refinement-spec-may29",
        "source_truth_run_id": row.get("source_truth_run_id"),
        "prompt_tokens": getattr(usage, "prompt_tokens", None) if usage else None,
        "completion_tokens": getattr(usage, "completion_tokens", None) if usage else None,
        "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
    })
    return ex


def validate_extraction(ex: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if ex.get("extraction_status") != "ok":
        issues.append(f"status={ex.get('extraction_status')}")
    if not ex.get("brand_category"):
        issues.append("missing_brand_category")
    if not isinstance(ex.get("hard_attributes"), dict) or not ex.get("hard_attributes"):
        issues.append("missing_hard_attributes")
    axes = ex.get("axis_scores") or {}
    for axis in AXES:
        score = (axes.get(axis) or {}).get("score")
        if not isinstance(score, int) or score < 1 or score > 10:
            issues.append(f"bad_axis_{axis}")
    if not ex.get("search_terms"):
        issues.append("missing_search_terms")
    if ex.get("is_multi_piece") and not ex.get("components"):
        issues.append("multi_piece_missing_components")
    return issues


def product_row_from_extraction(ex: dict[str, Any]) -> dict[str, Any]:
    source_truth = ex.get("source_truth") or {}
    primary = ex.get("final_primary_image") or source_truth.get("final_primary_image") or ""
    return {
        "product_id": ex.get("product_id") or ex.get("gtf_sku"),
        "title": ex.get("product_name") or ex.get("brand_sku"),
        "brand": "Try On Dress",
        "category": ex.get("brand_category") or ex.get("category"),
        "image_file": thumb_url(primary),
        "price": None,
        "currency": None,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--products-out", type=Path, default=DEFAULT_PRODUCTS_OUT)
    ap.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    ap.add_argument("--model", default=os.getenv("TOD_EXTRACTION_MODEL", "gpt-4o"))
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.4)
    ap.add_argument("--version", default="8.3", choices=["8.2", "8.3"])
    ap.add_argument("--sku-list", type=Path, help="Optional newline-delimited brand_sku/gtf_sku/product_id allow-list for spot-check runs")
    args = ap.parse_args()

    load_env()
    client = OpenAI()
    guard_path = ROOT / ("config/GTF_Extraction_Prompt_v8.3_guard.md" if args.version == "8.3" else "config/GTF_Extraction_Prompt_v8.2_guard.md")
    schema_path = ROOT / ("config/GTF_Extraction_Schema_v8.3.json" if args.version == "8.3" else "config/GTF_Extraction_Schema_v8.2.json")
    guard = guard_path.read_text(encoding="utf-8")
    schema = load_json(schema_path)
    queue_doc = load_json(args.queue)
    rows = queue_doc["items"]
    if args.sku_list:
        wanted = {line.strip() for line in args.sku_list.read_text(encoding="utf-8").splitlines() if line.strip() and not line.strip().startswith("#")}
        rows = [r for r in rows if str(r.get("brand_sku") or "") in wanted or str(r.get("gtf_sku") or "") in wanted or str(r.get("product_id") or "") in wanted or str(r.get("product_name") or "") in wanted]
    if args.limit:
        rows = rows[: args.limit]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    partial_path = args.out.with_suffix(".partial.json")
    failures_path = args.out.with_suffix(".failures.json")

    extractions: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    if partial_path.exists() and not args.force:
        extractions = load_json(partial_path)
    done = {e.get("product_id") or e.get("gtf_sku") for e in extractions}

    for idx, row in enumerate(rows, 1):
        sku = row["gtf_sku"]
        if sku in done and not args.force:
            print(f"[{idx}/{len(rows)}] reuse {sku}", flush=True)
            continue
        print(f"[{idx}/{len(rows)}] extract {sku} | {row.get('product_name')} | {row.get('brand_category')}", flush=True)
        try:
            if row.get("source_truth_review_status") != "approved":
                raise RuntimeError("row is not Source Truth approved")
            if not row.get("brand_category"):
                raise RuntimeError("missing brand_category")
            images = []
            for n, key in enumerate(["final_primary_image", "final_secondary_image"], 1):
                url = thumb_url(row[key])
                images.append(fetch_image_data_url(url, f"{sku}_{n}"))
            content: list[dict[str, Any]] = [{"type": "text", "text": build_prompt(row, guard, schema)}]
            for img in images:
                content.append({"type": "image_url", "image_url": {"url": img, "detail": "high"}})
            resp = client.chat.completions.create(
                model=args.model,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}],
                response_format={"type": "json_object"},
                temperature=0.05,
                max_tokens=3200,
            )
            raw = resp.choices[0].message.content or "{}"
            ex = json.loads(raw)
            ex = ensure_defaults(row, ex, args.model, resp.usage)
            issues = validate_extraction(ex)
            ex["ct_runtime_validation"] = {"status": "PASS" if not issues else "REVIEW", "issues": issues}
            extractions = [e for e in extractions if (e.get("product_id") or e.get("gtf_sku")) != sku]
            extractions.append(ex)
            partial_path.write_text(json.dumps(extractions, indent=2), encoding="utf-8")
            done.add(sku)
        except Exception as exc:
            failure = {"gtf_sku": sku, "brand_sku": row.get("brand_sku"), "product_name": row.get("product_name"), "error": repr(exc), "at": datetime.now(timezone.utc).isoformat()}
            failures.append(failure)
            failures_path.write_text(json.dumps(failures, indent=2), encoding="utf-8")
            print(f"  FAILED {sku}: {exc}", flush=True)
        time.sleep(args.sleep)

    ordered = []
    by_id = {e.get("product_id") or e.get("gtf_sku"): e for e in extractions}
    for row in rows:
        if row["gtf_sku"] in by_id:
            ordered.append(by_id[row["gtf_sku"]])
    args.out.write_text(json.dumps(ordered, indent=2), encoding="utf-8")
    args.products_out.write_text(json.dumps([product_row_from_extraction(e) for e in ordered], indent=2), encoding="utf-8")

    validation_issues = [(e.get("product_id"), e.get("ct_runtime_validation", {}).get("issues", [])) for e in ordered if e.get("ct_runtime_validation", {}).get("issues")]
    report = [
        "# TOD v8.3 GPT Extraction Audit — May 29, 2026",
        "",
        f"Generated at: `{datetime.now(timezone.utc).isoformat()}`",
        f"Model: `{args.model}`",
        f"Queue: `{args.queue}`",
        "",
        "## Counts",
        f"- Queue rows targeted: **{len(rows)}**",
        f"- Extraction outputs written: **{len(ordered)}**",
        f"- Failures this run: **{len(failures)}**",
        f"- Outputs with validation issues: **{len(validation_issues)}**",
        "",
        "## Files",
        f"- Extractions: `{args.out}`",
        f"- Products: `{args.products_out}`",
        f"- Partial checkpoint: `{partial_path}`",
        f"- Failures: `{failures_path}`",
        "",
        "## Gate",
        "- AR handoff is allowed only after targeted rows are extracted and validation issues are reviewed.",
        "- Do not include Source Truth exception rows.",
        "",
    ]
    if validation_issues[:30]:
        report += ["## Validation issues sample", ""]
        for sku, issues in validation_issues[:30]:
            report.append(f"- `{sku}`: {', '.join(issues)}")
    args.report.write_text("\n".join(report), encoding="utf-8")
    print(json.dumps({"targeted": len(rows), "extracted": len(ordered), "failures": len(failures), "validation_issues": len(validation_issues)}, indent=2), flush=True)
    return 0 if len(ordered) == len(rows) and not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
