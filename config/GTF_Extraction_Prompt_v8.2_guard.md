# GTF Extraction Prompt v8.2 — Structural Guardrail Draft

Status: draft guardrail for the next extraction run. Safe to add now; deeper axis/vibe tuning should wait for 30–50 clean reviewed products.

## Core rule
Treat product title, source category, filename, and collection labels as weak metadata hints only.
The product image is the primary source of truth.
If metadata contradicts visible evidence in the image, trust the image and flag a conflict instead of forcing the output to match metadata.

## Required structured output
```json
"metadata_image_conflict": {
  "has_conflict": true,
  "fields": ["category", "title"],
  "metadata_claim": "saree",
  "visual_evidence": "image shows a kaftan / flowy deep-V garment",
  "recommended_action": "trust_image_and_manual_review_source_metadata"
}
```

## Extraction behavior
- Do not use product title/category to override visible garment evidence.
- If image evidence is ambiguous, lower confidence and route to REVIEW/MANUAL.
- If the image does not appear to match the product row, output `image_mapping_suspected: true` and avoid confident hard-attribute/category claims.
- Category and hard attributes must cite visible image evidence when confidence is high.

## Scope guard
This guardrail prevents bad future extraction. It does not change the existing 74 paused lookbook rows; those require CSV/image-source repair and re-extraction first.
