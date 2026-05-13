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

export function normalizeValue(attribute: string, raw: any): { canonical: string | null; valid: boolean; warning?: string } {
  const value = typeof raw === 'object' && raw !== null && 'value' in raw ? raw.value : raw
  if (value == null) return { canonical: null, valid: false, warning: 'Missing value' }
  const str = String(value).trim()
  const lower = str.toLowerCase()
  const enumValues = getEnumForAttribute(attribute)
  if (!enumValues) return { canonical: str, valid: true }
  if (enumValues.includes(lower)) return { canonical: lower, valid: true }
  const alias = aliases[lower]
  if (alias && enumValues.includes(alias)) return { canonical: alias, valid: false, warning: `Non-canonical value mapped from ${str}` }
  if (alias === 'unknown') return { canonical: null, valid: false, warning: 'Unknown value requires review' }
  return { canonical: null, valid: false, warning: `Non-canonical value: ${str}` }
}

export function confidenceTier(confidence: number | undefined): 'AUTO' | 'REVIEW' | 'MANUAL' {
  if (typeof confidence !== 'number') return 'REVIEW'
  if (confidence >= 0.9) return 'AUTO'
  if (confidence >= 0.7) return 'REVIEW'
  return 'MANUAL'
}
