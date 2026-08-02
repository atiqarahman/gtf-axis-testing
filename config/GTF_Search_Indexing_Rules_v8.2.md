# GTF Search Indexing Rules v8.2

Purpose: prevent v8.1 contamination where shared-image separates and multi-piece products lose searchable garment intent.

## Required indexed fields

For every `extraction_status=ok` product, create one searchable document with these sources:

1. Product identity
   - `product_id`
   - `brand`
   - `product_name`
   - `brand_category`
   - normalized top-level `hard_attributes.category.value`

2. Top-level product attributes
   - `hard_attributes.*.value`
   - `hard_attributes.details[].value`
   - top-level `axis_scores` for ranking only, not lexical matching
   - `soft_attributes.gtf_keywords[]`, `occasion[]`, `style_references[]`, `destination[]` when present

3. Component fields for multi-piece products
   - `components[].piece_type`
   - `components[].role`
   - `components[].attributes.*.value`
   - `components[].attributes.details[].value`

4. Explicit `search_terms[]`
   - Treat as high-recall aliases/synonyms.
   - Must include combined terms for important component attributes: e.g. `beige bralette`, `sequined blazer`, `wide leg pants`.

## Field weights

Recommended lexical weights:

- 5.0: `brand_category`, `hard_attributes.category.value`, exact `components[].piece_type`
- 4.0: `search_terms[]`
- 3.0: component attribute bigrams generated from `{color/material/pattern/silhouette} + piece_type`
- 2.0: top-level hard attributes and component hard attributes
- 1.0: product title tokens and soft keywords

Do not let top-level category suppress component hits. A pantsuit with `components[].piece_type=bralette` must match `bralette` queries even though the top-level category is `pantsuit`.

## Flattened index payload

A safe denormalized payload shape:

```json
{
  "product_id": "GTF-AFRO-032",
  "category_terms": ["pantsuit", "co-ord set", "three piece set"],
  "attribute_terms": ["beige", "sequin", "sequined", "structured", "full-length", "glam"],
  "component_terms": ["blazer", "pants", "bralette"],
  "component_attribute_terms": [
    "beige blazer",
    "sequined blazer",
    "beige pants",
    "sequined pants",
    "beige bralette",
    "sequined bralette"
  ],
  "search_terms": ["beige pantsuit", "sequined pantsuit", "three piece set", "co-ord set"],
  "axis_scores": { "glamour": 9, "drama": 8, "styling_affordance": 5 }
}
```

## Query examples that must pass

- `bralette` returns `GTF-AFRO-032` because bralette exists in `components[].piece_type`.
- `wide leg pants` returns a pantsuit/co-ord if any pants component has wide/straight/full-length pants terms.
- `pantsuit` returns the top-level pantsuit product.
- `fringed skirt` returns the skirt SKU in a shared top/skirt image, not the visually dominant top SKU, when `brand_category=skirt`.

## Non-indexable rows

Rows with these statuses must not enter production search:

- `blocked_missing_brand_category`
- `blocked_source_truth_not_approved`
- `category_not_visible`
- `component_not_visible`
- `manual_review_required`

They can be indexed only in internal QA queues with `is_searchable=false`.
