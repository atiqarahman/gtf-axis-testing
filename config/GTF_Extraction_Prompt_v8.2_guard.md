# GTF Extraction Prompt v8.2 — Brand Category Scope + Component Search Guard

Status: CRITICAL — use before AFROPOP/TOD/Nikita extraction runs and before treating Taste Lab outputs as acceptance evidence.
Discovered by: Atiqa Rahman during Source Truth review.
Validated by: RK/Zoya GPT-4o side-by-side tests on real AFROPOP products.
Date: 2026-05-19.
Prompt guard version: `v8.2-brand-category-components-search`.

## Why v8.2 exists

v8.1 is unsafe for lookbook/catalog reality:

1. **Separate SKUs sharing one multi-garment image**
   - Example: trench coat SKU and pants SKU use the same model image.
   - Without category context, extraction can follow the visually dominant garment instead of the sold SKU.

2. **Multi-piece products sold as one SKU**
   - Example: pantsuit with bralette = blazer + pants + bralette sold together.
   - One flat hard-attribute object creates a mashup: neckline from blazer, length from pants, bralette ignored.

This poisons category, hard attributes, axis scoring, search, Shop the Look, and Variant C flat-lay focus.

## Mandatory request inputs

Every catalog extraction request MUST include:

```json
{
  "gtf_sku": "...",
  "brand_sku": "...",
  "product_name": "...",
  "brand_category": "PANTS | TOP | DRESS | SKIRT | JACKET | COAT | COORD SET | PANTSUIT | ...",
  "final_primary_image": "review-handoff final_primary_image",
  "final_secondary_image": "review-handoff final_secondary_image",
  "source_truth_run_id": "...",
  "source_truth_review_status": "approved | manual_fix | sent_to_review | skipped"
}
```

Hard gates:

- If `brand_category` is missing or blank, return `blocked_missing_brand_category` and do not extract.
- If `source_truth_review_status` is not `approved` or `manual_fix`, return `blocked_source_truth_not_approved` and do not extract.
- If final reviewed images are missing, return `manual_review_required` and do not guess from raw unreviewed images.

## Trust hierarchy

1. **Brand category** = target garment / set type / WHAT to extract.
2. **Reviewed final images** = visual evidence for HOW the target garment or set looks.
3. **Product name** = supporting context, especially for component count and named pieces.

Never let visual dominance override `brand_category` for catalog scope.

## Required output status values

Use one of:

- `ok`
- `blocked_missing_brand_category`
- `blocked_source_truth_not_approved`
- `category_not_visible`
- `component_not_visible`
- `manual_review_required`

Blocked rows must not produce production-searchable attributes, axis scores, components, or search terms.

## Single-garment SKU rule

When `brand_category` is a single garment category, extract ONLY the garment matching `brand_category`.

Required behavior:

1. Focus only on the target garment visible in the reviewed image.
2. Ignore other garments; they may be separate products/SKUs or styling pieces.
3. Top-level `hard_attributes.category.value` must equal the normalized target category.
4. Set `is_multi_piece=false`, `component_count=0`, `components=[]`.
5. Extract silhouette, length, material, color, pattern, fit, closure, embellishment, and other attributes for the target category only.
6. For bottoms (`pants`, `skirt`, `shorts`), set `neckline.value="none"` and `sleeve_length.value="none"`.
7. If target category is not visible, return `category_not_visible` and route to manual review.

Example: If `brand_category="pants"` and the image shows a model wearing a trench coat over denim pants, extract attributes for the pants only. Ignore the trench.

## Multi-piece product rule

When `brand_category` is set-like OR product name indicates multiple pieces (`set`, `co-ord`, `coord`, `pantsuit`, `with`, `and`, `&`, `+`), return BOTH:

1. top-level product attributes for the overall sold product
2. `components[]` with per-piece attributes
3. `search_terms[]` covering the top-level product and all components

Set-like categories include at minimum:

- `co-ord`, `coord set`, `co-ord set`
- `set`
- `pantsuit`
- `suit`
- `kurta set`, `lehenga set`, `anarkali set`
- any product title containing explicit multiple pieces

## Required v8.2 output additions

v8.2 preserves v8.1 `hard_attributes`, `axis_scores`, `styling_leverage`, and soft attributes, and adds:

```json
{
  "schema_version": "8.2",
  "extraction_status": "ok",
  "brand_category": "pantsuit",
  "target_scope": "single_garment | multi_piece_product",
  "source_truth": {
    "run_id": "...",
    "review_status": "approved",
    "final_primary_image": "...",
    "final_secondary_image": "..."
  },
  "is_multi_piece": true,
  "component_count": 3,
  "components": [],
  "search_terms": [],
  "metadata_image_conflict": { "has_conflict": false },
  "meta": {
    "schema_version": "8.2",
    "prompt_guard_version": "v8.2-brand-category-components-search"
  }
}
```

See `config/GTF_Extraction_Schema_v8.2.json` for the proposed JSON Schema and `config/GTF_Extraction_Examples_v8.2.json` for concrete examples.

## Component object shape

Each component MUST include:

```json
{
  "component_index": 1,
  "piece_type": "blazer",
  "role": "outerwear",
  "visibility": "visible | partially_visible | not_visible | inferred_from_name",
  "confidence": 0.0,
  "attributes": {
    "category": { "value": "blazer", "confidence": 0.0 },
    "primary_color": { "value": "beige", "confidence": 0.0 },
    "secondary_color": { "value": "none", "confidence": 0.0 },
    "material_primary": { "value": "sequin", "confidence": 0.0 },
    "material_secondary": { "value": "none", "confidence": 0.0 },
    "silhouette": { "value": "structured", "confidence": 0.0 },
    "length": { "value": "hip-length", "confidence": 0.0 },
    "neckline": { "value": "lapel", "confidence": 0.0 },
    "sleeve_length": { "value": "long", "confidence": 0.0 },
    "pattern": { "value": "sequined", "confidence": 0.0 },
    "details": [{ "value": "sequin", "confidence": 0.0 }]
  }
}
```

For bottom components, `neckline.value` and `sleeve_length.value` must be `none`.

## Top-level vs component rule

- Top-level hard attributes describe the overall sellable product.
- Component attributes describe individual pieces for search and matching.
- Do not force a single `neckline`, `length`, or `sleeve_length` to represent every piece in a set.
- Use `mixed` at top level only when a set genuinely contains incompatible component values, and preserve exact values inside `components[]`.
- Axis scores describe the overall sellable product, not only the visually loudest component.

## Search terms rule

Every successful output MUST include `search_terms[]`.

For single-garment products, include:

- `{primary_color} {category}`
- `{material/pattern} {category}`
- `{silhouette} {category}` when useful
- category synonyms from product name

For multi-piece products, include:

- top-level category terms (`pantsuit`, `co-ord set`, `three-piece set`)
- each `components[].piece_type`
- component bigrams such as `{color} {piece_type}`, `{pattern} {piece_type}`, `{silhouette} {piece_type}`
- named pieces from product name, e.g. `bralette`

Search must index:

- top-level category
- top-level hard attributes
- every `components[].piece_type`
- every component hard attribute
- every `search_terms[]`

Examples:

- “bralette” should match a pantsuit with a bralette component.
- “wide-leg pants” should match a pantsuit or co-ord with a pants component.
- “pantsuit” should match the overall product.

See `config/GTF_Search_Indexing_Rules_v8.2.md` for downstream indexing rules.

## Conflict / review behavior

If the target garment or a named component is not visible:

```json
{
  "extraction_status": "category_not_visible",
  "metadata_image_conflict": {
    "has_conflict": true,
    "fields": ["brand_category", "product_name"],
    "metadata_claim": "PANTS",
    "visual_evidence": "reviewed image appears to show only a trench coat; pants are not visible",
    "recommended_action": "manual_review_source_truth_or_brand_category"
  },
  "meta": { "confidence": "blocked" }
}
```

If brand category and visual evidence conflict, do not silently override category. Flag the conflict and route to review.

## Variant C flat-lay rule

Variant C flat-lay generation must receive the same `brand_category` and, for sets, component structure / target piece scope.

- If generating a flat-lay for the whole set, include all components.
- If generating a flat-lay for one component, explicitly pass `target_component`.
- Never pass a contaminated flat top-level mashup as the flat-lay source of truth.
