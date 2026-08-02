#!/usr/bin/env python3
"""Build the versioned ITRH 20 Taste Lab dataset from the audited gated fixture."""
import json
from pathlib import Path

SOURCE = Path('/Users/rahulkaushik/.openclaw/workspace/gtf-review/itrh-search-lab-sample-aug01/ITRH_20_PRODUCT_SEARCH_LAB_GATED_FIXTURE_AUG01.json')
OUT = Path(__file__).resolve().parents[1] / 'public' / 'data'
BATCH_ID = 'itrh_beta_20_aug01_2026'

def main():
    fixture = json.loads(SOURCE.read_text())
    products, extractions = [], []
    for row in fixture['documents']:
        truth = row['source_truth']
        products.append({'product_id': row['product_id'], 'title': row['product_name'], 'brand': row['brand'], 'category': row['brand_category'], 'image_file': truth['final_primary_image'], 'price': None, 'currency': 'INR'})
        extractions.append({'product_id': row['product_id'], 'schema_version': '8.3', 'brand_sku': row['brand_sku'], 'gtf_sku': row['gtf_sku'], 'product_name': row['product_name'], 'brand_category': row['brand_category'], 'category': row['normalized_category'], 'source_truth': truth, 'final_primary_image': truth['final_primary_image'], 'final_secondary_image': truth['final_secondary_image'], 'is_multi_piece': row['is_multi_piece'], 'component_count': row['component_count'], 'components': row['components'], 'search_terms': row['search_terms'], 'hard_attributes': row['hard_attributes'], 'axis_scores': row['axis_scores'], 'suggested_vibes': row['suggested_vibes'], 'primary_vibe': row['primary_vibe'], 'all_vibe_scores': {k: {'score': v, 'source': row['vibe_score_source']} for k, v in row['vibe_scores'].items()}, 'gpt_suggested_vibes': [], 'vibe_review_status': 'pending_ar_vibe_review', 'vibe_source': row['vibe_score_source'], 'product_tier': 'REVIEW', 'review_needed': ['taste_lab_human_review'], 'manual_needed': []})
    assert len(products) == len(extractions) == 20
    assert len({p['product_id'] for p in products}) == 20
    assert all(e['source_truth']['review_status'] == 'approved' and len(e['all_vibe_scores']) == 12 for e in extractions)
    (OUT / 'products_itrh_beta_20_aug01.json').write_text(json.dumps(products, indent=2) + '\n')
    (OUT / 'extractions_itrh_beta_20_aug01.json').write_text(json.dumps(extractions, indent=2) + '\n')
    print(json.dumps({'batch_id': BATCH_ID, 'products': 20, 'extractions': 20}))

if __name__ == '__main__': main()
