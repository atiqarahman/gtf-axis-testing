import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const ROOT = path.join(process.cwd(), 'images')
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  const safeParts = params.path.filter(Boolean).map((part) => part.replace(/\.\./g, ''))
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
