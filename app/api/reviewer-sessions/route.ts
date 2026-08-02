import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { get, put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

type SessionEvent = {
  event_id: string
  session_id: string
  event_type: string
  reviewer?: string
  dataset_version?: string
  page?: string
  product_id?: string
  review_count?: number
  client_created_at?: string
  server_received_at: string
  user_agent?: string
  ip?: string
  location: {
    source: 'vercel_headers' | 'ipapi_fallback' | 'ip_headers'
    country?: string
    region?: string
    city?: string
    latitude?: string
    longitude?: string
    timezone?: string
    accuracy?: string
    org?: string
  }
  meta?: Record<string, any>
}

type SessionPayload = {
  schema_version: 'gtf_reviewer_sessions_v1'
  updated_at: string
  summary: {
    total_events: number
    session_count: number
    latest_event_at?: string
  }
  events: SessionEvent[]
}

const SESSION_DIR = path.resolve(process.env.TASTE_LAB_SESSION_DIR || path.join(process.cwd(), 'data', 'reviews'))
const SESSION_FILE = path.join(SESSION_DIR, 'reviewer-sessions.json')
const IS_VERCEL = Boolean(process.env.VERCEL)
const ALLOW_EPHEMERAL = process.env.TASTE_LAB_ALLOW_EPHEMERAL_STORAGE === '1'
const HAS_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const BLOB_KEY = process.env.TASTE_LAB_SESSION_BLOB_KEY || 'taste-lab/reviewer-sessions.json'
const REVIEW_ACCESS_TOKEN = process.env.TASTE_LAB_REVIEW_ACCESS_TOKEN || ''
const REVIEW_ACCESS_HEADER = 'x-taste-lab-review-token'
const MAX_EVENTS = Number(process.env.TASTE_LAB_SESSION_MAX_EVENTS || 5000)

function authorized(request: NextRequest) {
  if (!REVIEW_ACCESS_TOKEN) return true
  return request.headers.get(REVIEW_ACCESS_HEADER) === REVIEW_ACCESS_TOKEN
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Taste Lab review access key required.' }, { status: 401 })
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('x-real-ip') || forwarded || request.headers.get('cf-connecting-ip') || ''
}

function isPublicIp(ip: string) {
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return false
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false
  return /^[a-f0-9:.]+$/i.test(ip)
}

function headerLocation(request: NextRequest): SessionEvent['location'] {
  return {
    source: request.headers.get('x-vercel-ip-city') || request.headers.get('x-vercel-ip-country') ? 'vercel_headers' : 'ip_headers',
    country: request.headers.get('x-vercel-ip-country') || undefined,
    region: request.headers.get('x-vercel-ip-country-region') || request.headers.get('x-vercel-ip-region') || undefined,
    city: request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city') || '') : undefined,
    latitude: request.headers.get('x-vercel-ip-latitude') || undefined,
    longitude: request.headers.get('x-vercel-ip-longitude') || undefined,
    timezone: request.headers.get('x-vercel-ip-timezone') || undefined,
  }
}

async function lookupIpLocation(ip: string): Promise<SessionEvent['location'] | null> {
  if (process.env.TASTE_LAB_DISABLE_IP_GEO_FALLBACK === '1' || !isPublicIp(ip)) return null
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { accept: 'application/json', 'user-agent': 'gtf-taste-lab-reviewer-session-audit/1.0' },
      signal: AbortSignal.timeout(1200),
    })
    if (!response.ok) return null
    const data: any = await response.json()
    if (data?.error) return null
    return {
      source: 'ipapi_fallback',
      country: data.country_name || data.country_code || undefined,
      region: data.region || data.region_code || undefined,
      city: data.city || undefined,
      latitude: data.latitude != null ? String(data.latitude) : undefined,
      longitude: data.longitude != null ? String(data.longitude) : undefined,
      timezone: data.timezone || undefined,
      org: data.org || undefined,
    }
  } catch {
    return null
  }
}

async function resolveLocation(request: NextRequest, ip: string): Promise<SessionEvent['location']> {
  const fromHeaders = headerLocation(request)
  if (fromHeaders.city || fromHeaders.country || fromHeaders.latitude || fromHeaders.longitude) return fromHeaders
  return (await lookupIpLocation(ip)) ?? fromHeaders
}

function summarize(events: SessionEvent[]): SessionPayload['summary'] {
  return {
    total_events: events.length,
    session_count: new Set(events.map((e) => e.session_id).filter(Boolean)).size,
    latest_event_at: events[events.length - 1]?.server_received_at,
  }
}

async function readSessions(): Promise<SessionPayload> {
  try {
    if (HAS_BLOB) {
      const blob = await get(BLOB_KEY, { access: 'private', useCache: false })
      if (!blob || blob.statusCode === 304 || !blob.stream) throw new Error('not found')
      const parsed = JSON.parse(await new Response(blob.stream).text())
      return { schema_version: 'gtf_reviewer_sessions_v1', updated_at: parsed.updated_at ?? '', summary: parsed.summary ?? summarize(parsed.events ?? []), events: parsed.events ?? [] }
    }
    const parsed = JSON.parse(await fs.readFile(SESSION_FILE, 'utf8'))
    return { schema_version: 'gtf_reviewer_sessions_v1', updated_at: parsed.updated_at ?? '', summary: parsed.summary ?? summarize(parsed.events ?? []), events: parsed.events ?? [] }
  } catch (error: any) {
    const message = String(error?.message ?? error)
    if (error?.code === 'ENOENT' || /not found/i.test(message)) return { schema_version: 'gtf_reviewer_sessions_v1', updated_at: '', summary: summarize([]), events: [] }
    throw error
  }
}

async function writeSessions(payload: SessionPayload) {
  if (HAS_BLOB) {
    await put(BLOB_KEY, JSON.stringify(payload, null, 2), { access: 'private', allowOverwrite: true, contentType: 'application/json' })
    return { mode: 'blob', durable: true }
  }
  if (IS_VERCEL && !ALLOW_EPHEMERAL) throw new Error('Durable session storage is not configured.')
  await fs.mkdir(SESSION_DIR, { recursive: true })
  await fs.writeFile(SESSION_FILE, JSON.stringify(payload, null, 2))
  return { mode: 'file', durable: !IS_VERCEL || ALLOW_EPHEMERAL }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized()
  try {
    const payload = await readSessions()
    const events = payload.events.slice(-MAX_EVENTS).reverse()
    return NextResponse.json({ ok: true, mode: HAS_BLOB ? 'blob' : 'file', durable: HAS_BLOB || !IS_VERCEL || ALLOW_EPHEMERAL, summary: summarize(payload.events), events })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized()
  try {
    const body = await request.json().catch(() => ({}))
    const now = new Date().toISOString()
    const ip = clientIp(request)
    const event: SessionEvent = {
      event_id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
      session_id: String(body.session_id || ''),
      event_type: String(body.event_type || 'activity'),
      reviewer: body.reviewer ? String(body.reviewer).slice(0, 120) : undefined,
      dataset_version: body.dataset_version ? String(body.dataset_version).slice(0, 20) : undefined,
      page: body.page ? String(body.page).slice(0, 200) : undefined,
      product_id: body.product_id ? String(body.product_id).slice(0, 120) : undefined,
      review_count: Number.isFinite(body.review_count) ? Number(body.review_count) : undefined,
      client_created_at: body.client_created_at ? String(body.client_created_at) : undefined,
      server_received_at: now,
      user_agent: request.headers.get('user-agent') || undefined,
      ip,
      location: await resolveLocation(request, ip),
      meta: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
    }
    if (!event.session_id) return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 })
    const existing = await readSessions()
    const events = [...existing.events, event].slice(-MAX_EVENTS)
    const payload: SessionPayload = { schema_version: 'gtf_reviewer_sessions_v1', updated_at: now, summary: summarize(events), events }
    const info = await writeSessions(payload)
    return NextResponse.json({ ok: true, ...info, summary: payload.summary })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? String(error) }, { status: 500 })
  }
}
