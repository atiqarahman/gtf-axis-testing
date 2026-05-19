import { ENUMS } from './constants'

const aliases: Record<string, string> = {
  indigo: 'blue',
  khaki: 'olive',
  peach: 'coral',
  'dark brown': 'brown',
  gunmetal: 'silver',
  pearl: 'white',
  lurex: 'sequin',
  corduroy: 'cotton',
  hemp: 'linen',
  georgette: 'chiffon',
  unknown: 'unknown',
  corseted: 'structured',
  'wide-leg': 'flared',
  peplum: 'structured',
  kaftan: 'draped',
  asymmetric: 'asymmetric',
  sheath: 'column',
  straight: 'straight',
  none: 'none',
  patchwork: 'color-block',
  pinstripe: 'striped',
  lace: 'lace',
  belted: 'draped',
  beaded: 'beading',
  sequined: 'sequin',
  embellished: 'beading',
  printed: 'printed',
  structured: 'structured',
}

export function getEnumForAttribute(attribute: string): string[] | null {
  if (attribute === 'material_primary' || attribute === 'material_secondary') return ENUMS.material
  if (attribute in ENUMS) return ENUMS[attribute as keyof typeof ENUMS]
  return null
}

export function normalizeValue(attribute: string, raw: any): { canonical: string | string[] | null; valid: boolean; warning?: string } {
  const enumValues = getEnumForAttribute(attribute)

  const normalizeOne = (input: any): { canonical: string | null; valid: boolean; warning?: string; original: string } => {
    const value = typeof input === 'object' && input !== null && 'value' in input ? input.value : input
    if (value == null) return { canonical: null, valid: false, warning: 'Missing value', original: '' }
    const str = String(value).trim()
    const lower = str.toLowerCase()
    if (!enumValues) return { canonical: str, valid: true, original: str }
    if (enumValues.includes(lower)) return { canonical: lower, valid: true, original: str }
    const alias = aliases[lower]
    if (alias === 'unknown') return { canonical: null, valid: false, warning: 'Unknown value requires review', original: str }
    if (alias && enumValues.includes(alias)) return { canonical: alias, valid: false, warning: `Non-canonical value mapped from ${str}`, original: str }
    return { canonical: null, valid: false, warning: `Non-canonical value: ${str}`, original: str }
  }

  const rawValues: any[] | null = Array.isArray(raw) ? raw : Array.isArray(raw?.value) ? raw.value : null
  if (rawValues) {
    const normalized: Array<{ canonical: string | null; valid: boolean; warning?: string; original: string }> = rawValues.map(normalizeOne)
    const canonical = normalized.map((n) => n.canonical).filter(Boolean) as string[]
    const missing = normalized.filter((n) => !n.canonical).map((n) => n.original).filter(Boolean)
    const mapped = normalized.filter((n) => n.warning && n.canonical).map((n) => `${n.original}→${n.canonical}`)
    if (!canonical.length) return { canonical: null, valid: false, warning: missing.length ? `Non-canonical values: ${missing.join(', ')}` : 'Missing value' }
    if (missing.length) return { canonical, valid: false, warning: `Non-canonical values: ${missing.join(', ')}` }
    if (mapped.length) return { canonical, valid: false, warning: `Mapped values: ${mapped.join(', ')}` }
    return { canonical, valid: true }
  }

  const normalized = normalizeOne(raw)
  return { canonical: normalized.canonical, valid: normalized.valid, warning: normalized.warning }
}

export function confidenceTier(confidence: number | undefined): 'AUTO' | 'REVIEW' | 'MANUAL' {
  if (typeof confidence !== 'number') return 'REVIEW'
  if (confidence >= 0.9) return 'AUTO'
  if (confidence >= 0.7) return 'REVIEW'
  return 'MANUAL'
}
