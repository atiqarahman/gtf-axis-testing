# GTF v8.3 Polarized Vibe Scoring Audit

Generated: 2026-05-30

## CTO verdict

AR is correct: the previous production vibe mapper collapsed most products into a narrow 5–15 point score band. That made customer-facing ranking weak even when the right vibes were present.

## Fix shipped in this patch

- Replaced mild normalized dot-product output with `production_vibe_mapper_v2_polarized`.
- Uses sharper vibe personality vectors and centered cosine scoring so axes that a vibe rejects actively penalize the score.
- Adds deterministic editorial adjustments from reviewed extraction signals, not image guessing:
  - fuchsia / embroidered / luxury / maxi / dramatic eveningwear
  - bralette / crop / strapless / body-aware tops
  - denim pantsuit / blazer / tailored separates
- Products can still appear across all vibes; this changes **ranking strength**, not catalog inclusion.

## Dataset verification

- Products rescored: 307
- Missing score rows: 0
- Average score spread across 12 vibes: 65.13 points
- Minimum spread: 31 points
- Maximum spread: 78 points

## AR three-product check

### AP/AP25/001 — Fuchsia embroidered kaftan
Top vibes now:
1. Dubai Glam — 98
2. Glam — 93
3. Wedding Guest — 89

Wrong vibes now suppressed:
- Beach & Resort — 20
- Old Money — 20
- Elevated Basics — 20

### AP/AP25/002 — Tan pleated one-shoulder crop top / bralette
Top vibes now:
1. Sexy Elegant — 95
2. IT Girl — 86
3. Cool Girl — 85

Wrong vibe suppressed:
- Old Money — 21

### AP/AP25/003 — Raw denim blazer + flared jeans / pantsuit
Top vibes now:
1. Cool Girl — 92
2. Elevated City — 84
3. Elevated Basics / Hailey Bieber — 76

Wrong vibes suppressed:
- Wedding Guest — 36
- Beach & Resort — 45
- Dubai Glam — 25
- Glam — 26

## Boundary

This is still file-based v8.3 validation and remains `pending_ar_vibe_review` until AR rechecks and approves.
