import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

type ReviewMap = Record<string, any>

const REVIEW_DIR = path.join(process.cwd(), 'data', 'reviews')
const REVIEW_FILE = path.join(REVIEW_DIR, 'axis-reviews.json')
const SNAPSHOT_FILE = path.join(REVIEW_DIR, 'axis-reviews.snapshots.jsonl')

async function ensureDir() {
  await fs.mkdir(REVIEW_DIR, { recursive: true })
}

async function readReviews(): Promise<ReviewMap> {
  try {
    const raw = await fs.readFile(REVIEW_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return Object.fromEntries(parsed.filter((r) => r?.product_id).map((r) => [r.product_id, r]))
    if (parsed && typeof parsed === 'object') return parsed.reviews ?? parsed
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error
  }
  return {}
}

function normalizeReviews(input: any): ReviewMap {
  if (!input) return {}
  const source = input.reviews ?? input
  if (Array.isArray(source)) return Object.fromEntries(source.filter((r) => r?.product_id).map((r) => [r.product_id, r]))
  if (source && typeof source === 'object') return source
  return {}
}

function mergeReviews(existing: ReviewMap, incoming: ReviewMap): ReviewMap {
  const merged = { ...existing }
  for (const [productId, review] of Object.entries(incoming)) {
    if (!productId || !review) continue
    const prev = merged[productId]
    const prevTime = Date.parse(prev?.reviewed_at ?? prev?.updated_at ?? 0) || 0
    const nextTime = Date.parse(review?.reviewed_at ?? review?.updated_at ?? 0) || Date.now()
    merged[productId] = nextTime >= prevTime ? { ...prev, ...review, product_id: productId, updated_at: new Date().toISOString() } : prev
  }
  return merged
}

function summarize(reviews: ReviewMap) {
  const list = Object.values(reviews)
  const completed = list.filter((r) => r.review_status === 'completed').length
  const skipped = list.filter((r) => r.review_status === 'skipped').length
  const approved = list.filter((r) => r.overall_decision === 'approve').length
  const withAttributeRows = list.filter((r) => (r.attribute_reviews ?? []).length > 0).length
  const attributeApproved = list.filter((r) => {
    const rows = r.attribute_reviews ?? []
    if (!rows.length) return false
    return rows.every((a: any) => ['accept', 'accept_normalized', 'override'].includes(a.decision))
  }).length
  const withAxisOverrides = list.filter((r) => (r.axis_overrides ?? []).length > 0).length
  const withVibeReview = list.filter((r) => (r.vibe_reviews ?? []).some((v: any) => v.decision !== 'unset')).length
  return { total: list.length, completed, skipped, approved, withAttributeRows, attributeApproved, withAxisOverrides, withVibeReview }
}

export async function GET() {
  try {
    await ensureDir()
    const reviews = await readReviews()
    return NextResponse.json({ ok: true, mode: 'file', writable: true, reviews, summary: summarize(reviews), path: REVIEW_FILE })
  } catch (error: any) {
    return NextResponse.json({ ok: false, mode: 'unavailable', writable: false, reviews: {}, summary: summarize({}), error: error?.message ?? String(error) }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDir()
    const body = await request.json()
    const incoming = normalizeReviews(body)
    const existing = await readReviews()
    const merged = mergeReviews(existing, incoming)
    const payload = {
      schema_version: 'gtf_axis_reviews_v1',
      updated_at: new Date().toISOString(),
      summary: summarize(merged),
      reviews: merged,
    }
    await fs.writeFile(REVIEW_FILE, JSON.stringify(payload, null, 2))
    await fs.appendFile(SNAPSHOT_FILE, JSON.stringify({ saved_at: payload.updated_at, source: body?.source ?? 'client_autosave', count: Object.keys(incoming).length, summary: payload.summary }) + '\n')
    return NextResponse.json({ ok: true, mode: 'file', writable: true, summary: payload.summary, saved_count: Object.keys(incoming).length, path: REVIEW_FILE })
  } catch (error: any) {
    return NextResponse.json({ ok: false, mode: 'unavailable', writable: false, error: error?.message ?? String(error) }, { status: 500 })
  }
}
