import { AXES, canonicalizeVibe } from './constants'
import { normalizeValue } from './normalization'
import { resolveImage } from './imageResolver'
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
  missingVibeScores: number
  v82Ready: number
  multiPieceExtractions: number
  missingBrandCategory: string[]
  imageStatusCounts: Record<string, number>
  imageIssues: { product_id: string; brand: string; image_file: string; status: string; message?: string; candidates: string[] }[]
  invalidEnums: { product_id: string; attribute: string; value: any; warning?: string }[]
}

async function fetchJson<T>(paths: string[]): Promise<T> {
  let lastError: unknown
  for (const path of paths) {
    try {
      const response = await fetch(path)
      if (response.ok) return response.json() as Promise<T>
      lastError = new Error(`${path} returned ${response.status}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export async function loadValidationData(): Promise<{ items: ValidationItem[]; qa: QaSummary }> {
  const [products, extractions] = await Promise.all([
    fetch('/data/products.json').then((r) => r.json()) as Promise<Product[]>,
    fetchJson<Extraction[]>(['/data/extractions_v8_2.json', '/data/extractions_v8.2.json', '/data/extractions_v8_1.json']),
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
  let missingVibeScores = 0
  let v82Ready = 0
  let multiPieceExtractions = 0
  const missingBrandCategory: string[] = []
  const imageStatusCounts: Record<string, number> = { ok: 0, url: 0, ambiguous: 0, missing: 0 }
  const imageIssues: QaSummary['imageIssues'] = []
  const invalidEnums: QaSummary['invalidEnums'] = []

  for (const product of products) {
    const image = resolveImage(product)
    imageStatusCounts[image.status] = (imageStatusCounts[image.status] ?? 0) + 1
    if (image.status === 'ambiguous' || image.status === 'missing') {
      imageIssues.push({ product_id: product.product_id, brand: product.brand, image_file: product.image_file, status: image.status, message: image.message, candidates: image.candidates.map((c) => c.label) })
    }
  }

  for (const e of extractions) {
    if (e.brand_category || e.components?.length || e.search_terms?.length || e.schema_version?.includes('8.2')) v82Ready++
    if (e.is_multi_piece || (e.components?.length ?? 0) > 0) multiPieceExtractions++
    if (!e.brand_category) missingBrandCategory.push(e.product_id)
    for (const axis of AXES) {
      const score = e.axis_scores?.[axis.id]?.score
      if (score == null) missingAxes++
      else if (typeof score !== 'number' || score < 1 || score > 10) invalidAxisScores++
    }
    const vibeScores = e.all_vibe_scores ?? {}
    const expectedVibes = ['Old Money','Glam','Cool Girl','Sexy Elegant','Wedding Guest','Dubai Glam','Elevated City','Winter Holidays','Beach & Resort','IT Girl','Elevated Basics / Hailey Bieber','Unique Finds']
    for (const vibe of expectedVibes) if (!(vibe in vibeScores)) missingVibeScores++
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
  return { items, qa: { totalProducts: products.length, totalExtractions: extractions.length, duplicateProducts, missingExtractions, missingProducts, invalidAxisScores, missingAxes, invalidVibes, missingVibeScores, v82Ready, multiPieceExtractions, missingBrandCategory, imageStatusCounts, imageIssues, invalidEnums } }
}
