import { BRAND_SLUGS } from './constants'
import { IMAGE_MANIFEST } from './imageManifest'
import type { ImageResolution, Product } from './types'

const knownFiles: Record<string, readonly string[]> = IMAGE_MANIFEST

function brandSlug(brand: string) {
  return BRAND_SLUGS[brand] ?? brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function stem(name: string) {
  const clean = name.split('/').pop() ?? name
  return clean.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function localSrc(slug: string, file: string) {
  return `/product-image/${encodeURIComponent(slug)}/${file.split('/').map(encodeURIComponent).join('/')}`
}

export function resolveImage(product: Product): ImageResolution {
  const image = product.image_file ?? ''
  if (image.startsWith('http')) return { status: 'url', src: image, candidates: [{ src: image, label: 'External URL', confidence: 'url' }] }
  const slug = brandSlug(product.brand)
  const fileName = image.split('/').pop() ?? image
  const files = knownFiles[slug] ?? []
  const fileSet = new Set(files)
  const candidates: { src: string; label: string; confidence: 'exact' | 'fallback' | 'candidate' | 'url' }[] = []
  const add = (file: string, confidence: 'exact' | 'fallback' | 'candidate') => {
    if (!fileSet.has(file)) return
    const src = localSrc(slug, file)
    if (!candidates.some((c) => c.src === src)) candidates.push({ src, label: file, confidence })
  }

  // Only add files known to exist. This prevents broken first images when product refs say .webp but repo has .jpg.
  add(fileName, 'exact')
  const fallback = fileName.replace(/\.(webp|png)$/i, '.jpg')
  if (fallback !== fileName) add(fallback, 'fallback')

  if (files.length) {
    const target = stem(fileName)
    for (const f of files) {
      const fs = stem(f)
      if (fs === target || fs.includes(target) || target.includes(fs)) add(f, 'candidate')
    }
  }

  candidates.sort((a, b) => {
    const rank = { exact: 0, fallback: 1, candidate: 2, url: 3 }
    return rank[a.confidence] - rank[b.confidence] || a.label.length - b.label.length
  })

  // Known ambiguous lookbook families: expose status so reviewer/dev does not trust guessed page mapping.
  if ((slug === 'shahin-mannan' || slug === 'surily-g') && /^page-\d+/i.test(fileName)) {
    const prefix = slug === 'shahin-mannan' ? 'Lookbook page needs collection prefix' : 'Surily collection page needs disambiguation'
    return { status: 'ambiguous', candidates, src: candidates[0]?.src, message: prefix }
  }
  if (candidates.length > 1) return { status: 'ambiguous', candidates, src: candidates[0].src, message: 'Multiple possible local images. Confirm before review.' }
  if (candidates.length === 1) return { status: 'ok', candidates, src: candidates[0].src }
  return { status: 'missing', candidates: [], message: 'No image candidate found' }
}
