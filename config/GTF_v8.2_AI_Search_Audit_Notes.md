# GTF v8.2 AI/Search Audit Notes

Date: 2026-05-19
Repo: `gtf-axis-testing`

## What I inspected

- `config/GTF_Extraction_Prompt_v8.1.txt`
- `config/GTF_Extraction_Prompt_v8.2_guard.md`
- `config/GTF_Attribute_Mapper_v2.json`
- `config/vibe_vectors_v1.json`
- `extractions_v8_1.json`
- `products.json`
- `lib/axis-validation/loadData.ts`
- `lib/axis-validation/types.ts`
- `components/axis-validation/ValidationWorkbench.tsx`

## Current state

### v8.1 extraction shape

The active extraction data is flat:

- one `hard_attributes` object per product
- one `axis_scores` object per product
- `suggested_vibes` + `all_vibe_scores`
- `product_tier`, `review_needed`, `reasoning_trace`

This works for simple single-garment products but is unsafe for:

1. shared model images where the target SKU is only one visible garment
2. set/co-ord/pantsuit products where one SKU contains multiple pieces

### Attribute Mapper / vibe vectors

`GTF_Attribute_Mapper_v2.json` and `vibe_vectors_v1.json` are compatible with v8.2 as ranking layers. They do not need structural changes for component extraction, but the search/indexing layer must flatten component fields before mapper/ranking can see them.

Important: vibe scoring should still use the overall sellable product axis profile. Component terms are for search recall and targeted matching, not a replacement for top-level product vibe identity.

### Taste Lab data shape

Taste Lab currently loads `public/data/extractions_v8_1.json` through `lib/axis-validation/loadData.ts`. Types in `lib/axis-validation/types.ts` do not include:

- `brand_category`
- `extraction_status`
- `source_truth`
- `is_multi_piece`
- `components[]`
- `search_terms[]`

Taste Lab review exports add `prompt_guard_version: 'v8.2-image-over-metadata-guard'`, but the current UI copy says image is source of truth over metadata. That is now too broad for catalog extraction: v8.2 must treat reviewed images as visual evidence but `brand_category` as target garment scope. The UI should rename this guard to `v8.2-brand-category-components-search` when it starts reviewing v8.2 outputs.

## Required v8.2 contract

- `brand_category` is mandatory and controls target garment/set scope.
- `source_truth_review_status` must be `approved` or `manual_fix`; `sent_to_review` is blocked.
- Single-garment categories output `is_multi_piece=false`, `component_count=0`, `components=[]`.
- Multi-piece categories output top-level product attributes plus `components[]`.
- `search_terms[]` is mandatory for searchable rows.
- Production search must index top-level category/attributes, component piece types/attributes, and explicit search terms.

## Files added

- `config/GTF_Extraction_Schema_v8.2.json` — proposed JSON Schema for v8.2 outputs.
- `config/GTF_Extraction_Examples_v8.2.json` — concrete single-garment, multi-piece, and blocked examples.
- `config/GTF_Search_Indexing_Rules_v8.2.md` — exact indexing/flattening rules.
- `config/GTF_v8.2_AFROPOP_Test_Fixtures.md` — 10-SKU AFROPOP fixture plan.

## Prompt audit result

`config/GTF_Extraction_Prompt_v8.2_guard.md` was directionally correct but needed stronger production gates:

- block unapproved Source Truth rows
- make `brand_category` outrank visual dominance for target scope
- define exact output status values
- require `components[]` and `search_terms[]`
- clarify that component attributes are indexed independently
- clarify single-garment bottoms must use `none` for neckline/sleeves

I strengthened the prompt accordingly.

## Recommended next implementation steps

1. Add v8.2 TypeScript types beside `lib/axis-validation/types.ts` before loading v8.2 JSON in Taste Lab.
2. Add a safe v8.2 fixture JSON once actual Source Truth handoff IDs are available.
3. Add a small validator script that checks:
   - schema validity
   - `brand_category` presence
   - blocked `sent_to_review` behavior
   - bottom neckline/sleeve rules
   - component search term coverage
4. Update Taste Lab copy from image-over-metadata to brand-category-scoped extraction review.
5. Re-run AFROPOP extraction on the 10-fixture set before full corpus extraction.
