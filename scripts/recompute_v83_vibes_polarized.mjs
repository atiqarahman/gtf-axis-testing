import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const EXTRACTIONS_PATH = path.join(ROOT, 'public/data/extractions_v8_3.json')
const VECTORS_PATH = path.join(ROOT, 'public/data/config/vibe_vectors_v1.json')
const REPORT_PATH = path.join(ROOT, 'gtf-v83-polarized-vibe-audit.json')

const cfg = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'))
const extractions = JSON.parse(fs.readFileSync(EXTRACTIONS_PATH, 'utf8'))
const axes = Object.keys(cfg.axes)

const OVERRIDES = {
  'Old Money': { minimalism: 9, polish: 10, body_awareness: 2, drama: 1, novelty: 2, craft: 8, boldness: 1, glamour: 2, trend_currency: 3, styling_affordance: 8, cultural_richness: 4 },
  'Glam': { minimalism: 1, polish: 8, body_awareness: 8, drama: 10, novelty: 4, craft: 5, boldness: 9, glamour: 10, trend_currency: 6, styling_affordance: 3, cultural_richness: 3 },
  'Dubai Glam': { minimalism: 1, polish: 9, body_awareness: 4, drama: 10, novelty: 5, craft: 8, boldness: 9, glamour: 10, trend_currency: 5, styling_affordance: 2, cultural_richness: 9 },
  'Cool Girl': { minimalism: 5, polish: 7, body_awareness: 5, drama: 4, novelty: 8, craft: 3, boldness: 9, glamour: 2, trend_currency: 9, styling_affordance: 8, cultural_richness: 2 },
  'Sexy Elegant': { minimalism: 3, polish: 8, body_awareness: 10, drama: 7, novelty: 5, craft: 3, boldness: 9, glamour: 7, trend_currency: 7, styling_affordance: 4, cultural_richness: 2 },
  'Wedding Guest': { minimalism: 3, polish: 9, body_awareness: 4, drama: 8, novelty: 4, craft: 7, boldness: 5, glamour: 8, trend_currency: 4, styling_affordance: 3, cultural_richness: 7 },
  'Beach & Resort': { minimalism: 5, polish: 5, body_awareness: 7, drama: 3, novelty: 4, craft: 4, boldness: 4, glamour: 1, trend_currency: 5, styling_affordance: 9, cultural_richness: 4 },
  'Elevated City': { minimalism: 9, polish: 10, body_awareness: 4, drama: 1, novelty: 3, craft: 4, boldness: 2, glamour: 1, trend_currency: 5, styling_affordance: 10, cultural_richness: 2 },
  'Elevated Basics / Hailey Bieber': { minimalism: 10, polish: 9, body_awareness: 4, drama: 1, novelty: 2, craft: 3, boldness: 2, glamour: 1, trend_currency: 5, styling_affordance: 10, cultural_richness: 1 },
  'IT Girl': { minimalism: 4, polish: 7, body_awareness: 7, drama: 6, novelty: 9, craft: 2, boldness: 9, glamour: 5, trend_currency: 10, styling_affordance: 6, cultural_richness: 2 },
  'Unique Finds': { minimalism: 2, polish: 6, body_awareness: 4, drama: 6, novelty: 10, craft: 10, boldness: 7, glamour: 3, trend_currency: 4, styling_affordance: 3, cultural_richness: 10 },
  'Winter Holidays': { minimalism: 3, polish: 7, body_awareness: 4, drama: 7, novelty: 4, craft: 6, boldness: 4, glamour: 8, trend_currency: 4, styling_affordance: 4, cultural_richness: 4 },
}

function fieldValue(x) { return String(x?.value ?? x ?? '').toLowerCase() }
function detailText(x) { return Array.isArray(x) ? x.map(fieldValue).join(' ') : fieldValue(x) }
function axisScore(e, axis) { return Number(e.axis_scores?.[axis]?.score ?? 5.5) }
function productText(e) {
  return [
    e.product_name, e.title, e.brand_category, e.category,
    ...(e.search_terms ?? []),
    fieldValue(e.hard_attributes?.category),
    fieldValue(e.hard_attributes?.primary_color),
    fieldValue(e.hard_attributes?.material_primary),
    fieldValue(e.hard_attributes?.silhouette),
    fieldValue(e.hard_attributes?.length),
    fieldValue(e.hard_attributes?.neckline),
    detailText(e.hard_attributes?.details),
    ...(e.components ?? []).flatMap((c) => [c.piece_type, c.role, fieldValue(c.attributes?.material_primary), fieldValue(c.attributes?.category)]),
  ].filter(Boolean).join(' ').toLowerCase()
}
function centeredCosine(e, displayName) {
  const vector = OVERRIDES[displayName]
  let dot = 0, np = 0, nv = 0
  for (const axis of axes) {
    const p = (axisScore(e, axis) - 5.5) / 4.5
    const v = ((vector?.[axis] ?? 5.5) - 5.5) / 4.5
    dot += p * v
    np += p * p
    nv += v * v
  }
  return dot / (Math.sqrt(np * nv) || 1)
}
function editorialAdjustment(e, displayName) {
  const text = productText(e)
  let score = 0
  const glamEvening = /(embroider|bead|embellish|fuchsia|silk|luxury|maxi|kaftan|draped)/.test(text) && axisScore(e, 'drama') >= 7 && axisScore(e, 'glamour') >= 7
  const revealingTop = /(bralette|crop|strapless|sleeveless|faux leather|cutout|plunging)/.test(text) || axisScore(e, 'body_awareness') >= 8
  const denimSuit = /(denim).*(pantsuit|blazer|trouser)|pantsuit.*denim|blazer.*denim/.test(text)

  if (glamEvening) {
    if (displayName === 'Dubai Glam') score += 8
    if (displayName === 'Glam') score += 10
    if (displayName === 'Wedding Guest') score += 12
    if (displayName === 'Unique Finds') score += 4
    if (['Old Money', 'Beach & Resort', 'Elevated Basics / Hailey Bieber'].includes(displayName)) score -= 18
    if (['Elevated City', 'Cool Girl'].includes(displayName)) score -= 12
  }
  if (revealingTop) {
    if (displayName === 'Sexy Elegant') score += 26
    if (displayName === 'IT Girl') score += 18
    if (displayName === 'Cool Girl') score += 26
    if (displayName === 'Glam') score += 8
    if (displayName === 'Old Money') score -= 24
    if (displayName === 'Wedding Guest') score -= 12
    if (displayName === 'Elevated City') score -= 8
  }
  if (denimSuit) {
    if (displayName === 'Cool Girl') score += 40
    if (displayName === 'Elevated City') score += 8
    if (displayName === 'Elevated Basics / Hailey Bieber') score += 5
    if (displayName === 'IT Girl') score += 12
    if (['Beach & Resort', 'Wedding Guest', 'Glam', 'Dubai Glam'].includes(displayName)) score -= 18
    if (displayName === 'Old Money') score -= 25
  }
  return score
}
function vibeScore(e, displayName) {
  const base = 50 + 55 * centeredCosine(e, displayName)
  const adjusted = base + editorialAdjustment(e, displayName)
  return Math.round(Math.max(20, Math.min(98, adjusted)))
}

const vibeEntries = Object.values(cfg.vibes).map((v) => v.display_name)
const auditIds = new Set(['GTF-AFROPOP-APAP25001', 'GTF-AFROPOP-APAP25002', 'GTF-AFROPOP-APAP25003'])
const audit = {}
let totalSpread = 0
let minSpread = Infinity
let maxSpread = -Infinity

for (const e of extractions) {
  const ranked = vibeEntries.map((displayName) => ({
    displayName,
    score: vibeScore(e, displayName),
    raw_score: Number((50 + 55 * centeredCosine(e, displayName)).toFixed(2)),
    adjustment: editorialAdjustment(e, displayName),
  })).sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))

  e.all_vibe_scores = Object.fromEntries(ranked.map((r) => [r.displayName, {
    score: r.score,
    raw_score: r.raw_score,
    adjustment: r.adjustment,
    source: 'production_vibe_mapper_v2_polarized',
  }]))
  e.primary_vibe = ranked[0]?.displayName ?? ''
  e.suggested_vibes = ranked.slice(0, 3).map((r) => r.displayName)
  e.vibe_confidence = ranked[0] ? Math.max(0, Math.min(1, Number(((ranked[0].score - ranked[1].score) / 30).toFixed(2)))) : 0
  e.vibe_review_status = 'pending_ar_vibe_review'
  e.vibe_source = 'polarized_v2_file_based_validation_not_production_approved'
  const scores = ranked.map((r) => r.score)
  const spread = Math.max(...scores) - Math.min(...scores)
  totalSpread += spread
  minSpread = Math.min(minSpread, spread)
  maxSpread = Math.max(maxSpread, spread)
  if (auditIds.has(e.product_id)) audit[e.product_id] = { product_name: e.product_name, ranked }
}

fs.writeFileSync(EXTRACTIONS_PATH, JSON.stringify(extractions, null, 2) + '\n')
fs.writeFileSync(REPORT_PATH, JSON.stringify({
  generated_at: new Date().toISOString(),
  source: 'production_vibe_mapper_v2_polarized',
  count: extractions.length,
  average_spread: Number((totalSpread / extractions.length).toFixed(2)),
  min_spread: minSpread,
  max_spread: maxSpread,
  audit,
}, null, 2) + '\n')

console.log(JSON.stringify(JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')), null, 2))
