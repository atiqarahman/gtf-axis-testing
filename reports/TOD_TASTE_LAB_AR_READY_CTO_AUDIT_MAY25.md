# TOD Taste Lab AR-Ready CTO Audit — May 25, 2026

## Verdict

**AR-ready locally after GPT extraction and Taste Lab load.**

TOD is now the active Taste Lab dataset with real GPT v8.2 extraction outputs. This is no longer just Source Truth image staging.

## Pipeline completed

1. AR Source Truth export audited.
2. 249 clean approved TOD products separated from 18 exceptions.
3. GPT extraction run on all 249 approved products using final primary + secondary images.
4. One bad extraction was identified (`GTF-TOD-021060005220XSS`, model returned `blocked_missing_brand_category`) and rerun.
5. Final extraction validation now passes 249/249.
6. Active Taste Lab data switched from AFROPOP to TOD, with AFROPOP archived.
7. Drive image loading moved behind same-origin `/product-image/drive/{fileId}` proxy to avoid browser ORB/CORS failures.
8. Taste Lab review counters patched to count only active dataset product IDs, so old AFROPOP/localStorage/server reviews do not contaminate TOD progress metrics.

## Counts

- Active Taste Lab products: **249**
- Active Taste Lab extractions: **249**
- Extraction status `ok`: **249**
- Runtime validation issues: **0**
- Source Truth exceptions kept out: **18**
- Duplicate normalized Source Truth SKU collision noted separately: `GTF-TOD-002101005510XSS`

## Category distribution

- Dresses: 72
- Cardigans: 43
- Skirts: 38
- Sweaters: 27
- Tank Tops: 23
- Pants: 17
- Clothing Tops: 13
- Scarves & Shawls: 7
- Shirts: 3
- Outerwear: 3
- Overcoats: 2
- Crop Tops: 1

## Files changed/created

- Active dataset:
  - `public/data/products.json`
  - `public/data/extractions_v8_2.json`
  - `public/data/export_summary.json`
- TOD artifacts:
  - `public/data/tod/tod_source_truth_approved_249.json`
  - `public/data/tod/tod_v82_extraction_input_queue_249.json`
  - `public/data/tod/tod_extractions_v8_2.json`
  - `public/data/tod/tod_products_extracted_249.json`
  - `public/data/tod/tod_source_truth_exceptions_18.json/.csv`
  - `public/data/tod/tod_import_manifest.json`
- AFROPOP backup:
  - `public/data/archive/afropop-before-tod-may25/`
- Scripts:
  - `scripts/prepare_tod_taste_lab_queue.py`
  - `scripts/run_tod_v82_extraction.py`
- UI fixes:
  - `app/product-image/[...path]/route.ts`
  - `lib/axis-validation/imageResolver.ts`
  - `components/axis-validation/ValidationWorkbench.tsx`

## Verification

- Source Truth approved queue audit: PASS
- GPT extraction smoke test: 3/3 PASS before full run
- Full GPT extraction: 249/249 outputs, 0 failures
- Final extraction schema/runtime validation: PASS, 0 issues
- Same-origin image proxy single check: PASS, JPEG returned
- Bulk image proxy audit: 248/249 first pass, one transient timeout; immediate retry for that SKU passed 3/3 times
- Playwright Taste Lab UI smoke: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

Known build warning: Next/Turbopack NFT warning from review API dynamic file/blob storage trace. Build still succeeds; this is pre-existing/non-blocking for AR review.

## CTO notes for AR

- AR should review TOD in Taste Lab as extraction review, not Source Truth review.
- The 18 exception rows are intentionally excluded and should not block AR.
- AR should focus on category/color/material/silhouette/length/neckline/sleeve/pattern/details/price tier, plus axis/vibe reasonableness.
- For bottoms and accessories, watch for invalid anatomy fields (`neckline`, `sleeve_length`) and mark corrections where needed.
- Search Lab should wait until AR completes TOD extraction review and we combine TOD + AFROPOP findings for v8.3.
