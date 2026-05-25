import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const ROOT = path.join(process.cwd(), 'images')
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  const safeParts = params.path.filter(Boolean).map((part) => part.replace(/\.\./g, ''))
  if (safeParts[0] === 'drive' && safeParts[1]) {
    const fileId = safeParts[1].replace(/[^a-zA-Z0-9_-]/g, '')
    if (!fileId) return new NextResponse('Invalid Drive file id', { status: 400 })
    const upstream = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1400`
    const response = await fetch(upstream, { headers: { 'user-agent': 'Mozilla/5.0' }, cache: 'force-cache' })
    if (!response.ok) return new NextResponse('Drive image not found', { status: response.status })
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const bytes = await response.arrayBuffer()
    return new NextResponse(bytes, { headers: { 'content-type': contentType, 'cache-control': 'public, max-age=86400' } })
  }

  const filePath = path.join(ROOT, ...safeParts)
  if (!filePath.startsWith(ROOT)) return new NextResponse('Invalid path', { status: 400 })
  try {
    const bytes = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    return new NextResponse(bytes, { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } })
  } catch {
    return new NextResponse('Image not found', { status: 404 })
  }
}
