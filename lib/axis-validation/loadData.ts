import { AXES, canonicalizeVibe } from './constants'
import { normalizeValue } from './normalization'
import type { Extraction, Product } from './types'

export type ValidationItem = { product: Product; extraction: Extraction }
export type QaSummary = {
  totalProducts: number
  totalExtractions: number
  duplicateProducts: string[]
  missingExtractions: string[]
  missingProducts: string[]
  invalidAxisScores: number
  missingAxes: number
  invalidVibes: number
  invalidEnums: { product_id: string; attribute: string; value: any; warning?: string }[]
}

export async function loadValidationData(): Promise<{ items: ValidationItem[]; qa: QaSummary }> {
  const [products, extractions] = await Promise.all([
    fetch('/data/products.json').then((r) => r.json()) as Promise<Product[]>,
    fetch('/data/extractions_v8_1.json').then((r) => r.json()) as Promise<Extraction[]>,
  ])
  const productIds = products.map((p) => p.product_id)
  const extractionIds = extractions.map((e) => e.product_id)
  const duplicateProducts = productIds.filter((id, idx) => productIds.indexOf(id) !== idx)
  const productMap = new Map(products.map((p) => [p.product_id, p]))
  const extractionMap = new Map(extractions.map((e) => [e.product_id, e]))
  const missingExtractions = productIds.filter((id) => !extractionMap.has(id))
  const missingProducts = extractionIds.filter((id) => !productMap.has(id))
  let invalidAxisScores = 0
  let missingAxes = 0
  let invalidVibes = 0
  const invalidEnums: QaSummary['invalidEnums'] = []

  for (const e of extractions) {
    for (const axis of AXES) {
      const score = e.axis_scores?.[axis.id]?.score
      if (score == null) missingAxes++
      else if (typeof score !== 'number' || score < 1 || score > 10) invalidAxisScores++
    }
    for (const vibe of [...(e.suggested_vibes ?? []), ...(e.gpt_suggested_vibes ?? [])]) {
      if (!canonicalizeVibe(vibe)) invalidVibes++
    }
    for (const [attribute, raw] of Object.entries(e.hard_attributes ?? {})) {
      if (attribute === 'details' && Array.isArray(raw)) {
        for (const detail of raw) {
          const result = normalizeValue('details', detail)
          if (!result.valid) invalidEnums.push({ product_id: e.product_id, attribute: 'details', value: detail?.value ?? detail, warning: result.warning })
        }
      } else {
        const result = normalizeValue(attribute, raw)
        if (!result.valid && result.warning) invalidEnums.push({ product_id: e.product_id, attribute, value: raw?.value ?? raw, warning: result.warning })
      }
    }
  }

  const items = products.filter((p) => extractionMap.has(p.product_id)).map((product) => ({ product, extraction: extractionMap.get(product.product_id)! }))
  return { items, qa: { totalProducts: products.length, totalExtractions: extractions.length, duplicateProducts, missingExtractions, missingProducts, invalidAxisScores, missingAxes, invalidVibes, invalidEnums } }
}
