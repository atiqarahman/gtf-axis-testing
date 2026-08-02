# TOD Source Truth → Taste Lab CTO Audit — May 25, 2026

## Verdict

**Controlled handoff complete.** 249 AR-approved TOD products have been staged for GPT v8.2/v8.3 extraction using the Source Truth contract. They are **not** marked Taste-Lab-reviewable yet because Taste Lab must review real extraction outputs, not fabricated placeholder axis scores.

## Inputs

- Source Truth run: `3db82f22`
- AR export timestamp: `2026-05-25T12:38:30.582Z`
- Generated at: `2026-05-25T13:47:45.322170+00:00`
- AR review file: `/Users/rahulkaushik/.openclaw/media/inbound/source_truth_ar_reviews_3db82f22---a88e993b-42d1-4277-aaa6-30e2c0cc2be2.json`
- Source Truth run file: `/Users/rahulkaushik/projects/gtf-source-truth-review/deploy-seed/source-truth/3db82f22/source_truth_run.json`
- Downstream handoff file: `/Users/rahulkaushik/projects/gtf-source-truth-review/deploy-seed/source-truth/3db82f22/source_truth_downstream_handoff.json`

## Counts

- Raw run rows: **268**
- Unique GTF SKUs: **267**
- AR review rows: **262**
- AR status counts: `{'manual_fix': 1, 'approved': 249, 'sent_to_review': 12}`
- Approved with curated primary + secondary: **249**
- Blocked exceptions: **18**
- Duplicate normalized SKU collision rows: **2**

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

`{'exclude_from_taste_lab_until_AR_or_media_fix': 13, 'missing_media_ticket_for_Suman_Muskaan': 5}`

## Duplicate SKU collision

The raw TOD run has duplicate normalized SKU: `GTF-TOD-002101005510XSS`.
This needs a SKU-normalization fix before production import, because two visually/color-distinct products can collapse into one product id.

## Next engineering step

Run extraction against the 249-item queue with the locked Source Truth contract:

```txt
Source Truth approved primary/secondary images → GPT v8.2/v8.3 extraction → Taste Lab review → vibe scoring/Search Lab
```

