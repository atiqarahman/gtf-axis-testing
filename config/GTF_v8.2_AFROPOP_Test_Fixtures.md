# GTF v8.2 AFROPOP Test Fixture Plan

Fixture set: 10 AFROPOP SKUs covering shared-image separates, multi-piece products, simple garments, and blocked source-truth rows.

## Acceptance rules

- Every runnable fixture must include `brand_category` and `source_truth_review_status=approved` or `manual_fix`.
- `brand_category` controls target garment scope.
- Shared-image single-garment SKUs must ignore non-target garments.
- Set-like products must output `is_multi_piece=true`, `components[]`, and `search_terms[]`.
- `sent_to_review` fixture must return `blocked_source_truth_not_approved` and produce no searchable document.
- Downstream flat-lay generation receives `brand_category`; for sets it also receives `components[]` and optional `target_component`.

## Fixtures

| # | SKU | Product | brand_category | Status | Case | Expected v8.2 behavior |
|---|---|---|---|---|---|---|
| 1 | GTF-AFRO-023 | BROWN GEOMETRIC PRINT LUREX TRENCH | coat | approved | trench/pants shared-image separate | Extract coat/trench only: lapel/long sleeve/structured/full or long outerwear; ignore pants as separate styling. `is_multi_piece=false`. |
| 2 | GTF-AFRO-024 | INDIGO HEMP DENIM PANTS | pants | approved | trench/pants shared-image separate | Extract pants only: no neckline/sleeve; ignore trench/top. Search terms include `indigo pants`, `denim pants`, `full length pants`. |
| 3 | GTF-AFRO-032 | BEIGE LUXE SHEETED SEQUINS PANTSUIT WITH BRALETTE | pantsuit | approved | pantsuit + bralette | `is_multi_piece=true`; components: blazer, pants, bralette. Search terms must include `bralette`, `sequined bralette`, `sequined pants`, `beige blazer`, `three piece set`. |
| 4 | GTF-AFRO-014 | INDIGO PRINT SHEETED SEQUINS PANTSUIT | pantsuit | approved | two-piece pantsuit | Components: blazer/jacket + pants. Top-level category stays pantsuit. Do not collapse neckline/length into one misleading field without component detail. |
| 5 | GTF-AFRO-044 | ONE SHOULDER BROWN GEOMETRIC PRINT TOP WITH GLASS BEAD EMBROIDERY | top | approved | top/skirt shared image | Extract top only: one-shoulder, sleeveless/asymmetric, crop/fitted, geometric/beaded. Ignore skirt. |
| 6 | GTF-AFRO-045 | BROWN GEOMETRIC PRINT FRINGED SKIRT | skirt | approved | top/skirt shared image | Extract skirt only: mini/short, fringe, geometric. Neckline/sleeve must be `none`. Ignore top neckline. |
| 7 | GTF-AFRO-053 | INDIGO PRINTED WIDE LEG PLEATED PANTS WITH BELT | pants | approved | simple garment bottom | Extract pants only: wide/straight or flowy, full-length, pleated/belt. Neckline/sleeve `none`. |
| 8 | GTF-AFRO-054 | INDIGO SWIRL PRINTED CORSET | top | approved | simple garment top | Extract corset/top only: fitted/corseted, crop/short, strapless or structured neckline if visible, swirl/printed. |
| 9 | GTF-AFRO-029 | BEIGE LUXE SHEETED SEQUINS KIMONO DRESS | dress | approved | simple one-piece dress | `is_multi_piece=false`; category=dress; no components. Search terms include `beige sequin dress`, `kimono dress`. |
| 10 | GTF-AFRO-999 | Negative control placeholder | dress | sent_to_review | source truth not approved | Return `blocked_source_truth_not_approved`; no attributes, axis scores, components, or search terms; `is_searchable=false`. |

## Minimum automated assertions

1. Schema: all runnable rows validate against `config/GTF_Extraction_Schema_v8.2.json`.
2. Scope: `hard_attributes.category.value` equals normalized `brand_category` for single-garment rows.
3. Bottoms: pants/skirt fixtures have `neckline.value=none` and `sleeve_length.value=none`.
4. Components: pantsuit fixtures have `component_count >= 2` and non-empty `components[].piece_type`.
5. Component search: every component produces at least one term in `search_terms[]`.
6. Search indexing: flattened terms include top-level category, component piece types, component hard attributes, and explicit search terms.
7. Negative control: `sent_to_review` row is blocked and cannot be indexed for production search.
