import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { get, put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

type ReviewMap = Record<string, any>

const REVIEW_DIR = path.resolve(process.env.TASTE_LAB_REVIEW_DIR || path.join(process.cwd(), 'data', 'reviews'))
const REVIEW_FILE = path.join(REVIEW_DIR, 'axis-reviews.json')
const SNAPSHOT_FILE = path.join(REVIEW_DIR, 'axis-reviews.snapshots.jsonl')
const IS_VERCEL = Boolean(process.env.VERCEL)
const ALLOW_EPHEMERAL = process.env.TASTE_LAB_ALLOW_EPHEMERAL_STORAGE === '1'
const BLOB_KEY = process.env.TASTE_LAB_REVIEW_BLOB_KEY || 'taste-lab/axis-reviews.json'
const BLOB_SNAPSHOT_PREFIX = process.env.TASTE_LAB_REVIEW_BLOB_SNAPSHOT_PREFIX || 'taste-lab/snapshots'
const HAS_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
const KV_KEY = process.env.TASTE_LAB_REVIEW_KV_KEY || 'gtf:taste-lab:axis-reviews'
const HAS_KV = Boolean(KV_URL && KV_TOKEN)
const REVIEW_ACCESS_TOKEN = process.env.TASTE_LAB_REVIEW_ACCESS_TOKEN || ''
const REVIEW_ACCESS_HEADER = 'x-taste-lab-review-token'

type StorageInfo = { mode: 'blob' | 'kv' | 'file'; durable: boolean }

function authorized(request: NextRequest) {
  if (!REVIEW_ACCESS_TOKEN) return true
  return request.headers.get(REVIEW_ACCESS_HEADER) === REVIEW_ACCESS_TOKEN
}

function unauthorized() {
  return NextResponse.json({ ok: false, mode: 'unauthorized', writable: false, durable: false, reviews: {}, summary: summarize({}), error: 'Taste Lab review access key required.' }, { status: 401 })
}

function storageInfo(): StorageInfo {
  if (HAS_BLOB) return { mode: 'blob', durable: true }
  if (HAS_KV) return { mode: 'kv', durable: true }
  if (IS_VERCEL && !ALLOW_EPHEMERAL) {
    throw new Error('Durable review storage is not configured. Set Upstash/Vercel KV env vars or deploy on persistent disk before review work resumes.')
  }
  return { mode: 'file', durable: !IS_VERCEL || ALLOW_EPHEMERAL }
}

async function ensureDir() {
  const info = storageInfo()
  if (info.mode === 'file') await fs.mkdir(REVIEW_DIR, { recursive: true })
}

async function kvCommand(command: any[]) {
  if (!HAS_KV) throw new Error('KV storage is not configured')
  const response = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([command]),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`KV ${command[0]} failed: ${response.status}`)
  return Array.isArray(data) ? data[0]?.result : data?.result
}

async function readReviews(): Promise<ReviewMap> {
  try {
    if (HAS_BLOB) {
      const blob = await get(BLOB_KEY, { access: 'private', useCache: false })
      if (!blob || blob.statusCode === 304 || !blob.stream) return {}
      const raw = await new Response(blob.stream).text()
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return Object.fromEntries(parsed.filter((r) => r?.product_id).map((r) => [r.product_id, r]))
      if (parsed && typeof parsed === 'object') return parsed.reviews ?? parsed
      return {}
    }

    if (HAS_KV) {
      const raw = await kvCommand(['GET', KV_KEY])
      if (!raw) return {}
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed)) return Object.fromEntries(parsed.filter((r) => r?.product_id).map((r) => [r.product_id, r]))
      if (parsed && typeof parsed === 'object') return parsed.reviews ?? parsed
      return {}
    }

    const raw = await fs.readFile(REVIEW_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return Object.fromEntries(parsed.filter((r) => r?.product_id).map((r) => [r.product_id, r]))
    if (parsed && typeof parsed === 'object') return parsed.reviews ?? parsed
  } catch (error: any) {
    const message = String(error?.message ?? error)
    if (HAS_BLOB && (error?.name === 'BlobNotFoundError' || /not found/i.test(message))) return {}
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

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized()
  try {
    await ensureDir()
    const info = storageInfo()
    const reviews = await readReviews()
    return NextResponse.json({ ok: true, mode: info.mode, writable: true, durable: info.durable, reviews, summary: summarize(reviews) })
  } catch (error: any) {
    return NextResponse.json({ ok: false, mode: 'unavailable', writable: false, durable: false, reviews: {}, summary: summarize({}), error: error?.message ?? String(error) }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized()
  try {
    await ensureDir()
    const info = storageInfo()
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

    const snapshot = JSON.stringify({
      saved_at: payload.updated_at,
      source: body?.source ?? 'client_autosave',
      count: Object.keys(incoming).length,
      summary: payload.summary,
      reviews: merged,
    })

    if (info.mode === 'blob') {
      await put(BLOB_KEY, JSON.stringify(payload, null, 2), { access: 'private', allowOverwrite: true, contentType: 'application/json' })
      await put(`${BLOB_SNAPSHOT_PREFIX}/${payload.updated_at.replace(/[:.]/g, '-')}.json`, snapshot, { access: 'private', allowOverwrite: true, contentType: 'application/json' })
    } else if (info.mode === 'kv') {
      await kvCommand(['SET', KV_KEY, JSON.stringify(payload)])
      await kvCommand(['LPUSH', `${KV_KEY}:snapshots`, snapshot])
      await kvCommand(['LTRIM', `${KV_KEY}:snapshots`, 0, 49])
    } else {
      await fs.writeFile(REVIEW_FILE, JSON.stringify(payload, null, 2))
      await fs.appendFile(SNAPSHOT_FILE, snapshot + '\n')
    }

    return NextResponse.json({ ok: true, mode: info.mode, writable: true, durable: info.durable, summary: payload.summary, saved_count: Object.keys(incoming).length })
  } catch (error: any) {
    return NextResponse.json({ ok: false, mode: 'unavailable', writable: false, durable: false, error: error?.message ?? String(error) }, { status: 500 })
  }
}
