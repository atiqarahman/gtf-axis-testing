import { ENUMS } from './constants'

const aliases: Record<string, string> = {
  indigo: 'blue',
  khaki: 'olive',
  'dark brown': 'brown',
  gunmetal: 'silver',
  pearl: 'white',
  'faux leather': 'faux-leather',
  'faux-leather': 'faux-leather',
  tensel: 'tencel',
  hemp: 'linen',
  georgette: 'chiffon',
  unknown: 'unknown',
  corseted: 'structured',
  peplum: 'structured',
  kaftan: 'kaftan',
  asymmetric: 'asymmetric',
  sheath: 'sheath',
  straight: 'straight',
  none: 'none',
  patchwork: 'color-block',
  pinstripe: 'pinstripe',
  lace: 'lace',
  beaded: 'beading',
  sequined: 'sequin',
  embellished: 'beading',
  printed: 'printed',
  structured: 'structured',
  ardesia: 'charcoal',
  rosemary: 'sage',
  hazelnut: 'chocolate',
  anthracite: 'charcoal',
  milk: 'ivory',
  mocha: 'taupe',
  creme: 'cream',
  mid: 'mid-range',
  'mid range': 'mid-range',
  'baby blue': 'baby-blue',
  'floor-length': 'maxi',
  'hip-length': 'hip',
  'knee-length': 'knee',
  'above-knee': 'mini',
  'waist-length': 'crop',
  'boat neck': 'boat',
  boatneck: 'boat',
  'spaghetti straps': 'spaghetti',
}

const detailAliases: Record<string, string[]> = {
  'beaded cuffs': ['beading'],
  'sequin cuffs': ['sequin'],
  'sequined cuffs': ['sequin'],
  'gold hardware straps': ['gold-hardware', 'spaghetti-strap'],
  'gold hardware': ['gold-hardware'],
  'silver hardware': ['silver-hardware'],
  topstitching: ['topstitched'],
  topstitched: ['topstitched'],
  slit: ['high-slit'],
  'high slit': ['high-slit'],
  'front slit': ['front-slit'],
  'spaghetti straps': ['spaghetti-strap'],
  buttons: ['buttoned'],
  pockets: ['pockets'],
  belt: ['belted'],
  belted: ['belted'],
  lurex: ['lurex'],
  ribbed: ['ribbed'],
  'cable knit': ['cable-knit'],
}

export function getEnumForAttribute(attribute: string): string[] | null {
  if (attribute === 'material_primary' || attribute === 'material_secondary') return ENUMS.material
  if (attribute in ENUMS) return ENUMS[attribute as keyof typeof ENUMS]
  return null
}

function normalizeRawString(value: string): string {
  return value.trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ')
}

function detailsFromString(raw: string): string[] {
  return raw
    .split(/[,;/+&]|\band\b/i)
    .map((part) => normalizeRawString(part))
    .filter(Boolean)
    .flatMap((part) => detailAliases[part] ?? [part])
}

function attributeAwareAlias(attribute: string, lower: string): string | undefined {
  if (attribute === 'sleeve_length' && lower === 'none') return 'n/a'
  if ((attribute === 'neckline' || attribute === 'length') && lower === 'none') return 'n/a'
  return aliases[lower]
}

export function normalizeValue(attribute: string, raw: any): { canonical: string | string[] | null; valid: boolean; warning?: string } {
  const enumValues = getEnumForAttribute(attribute)

  const normalizeOne = (input: any): { canonical: string | null; valid: boolean; warning?: string; original: string } => {
    const value = typeof input === 'object' && input !== null && 'value' in input ? input.value : input
    if (value == null) return { canonical: null, valid: false, warning: 'Missing value', original: '' }
    const str = String(value).trim()
    const lower = normalizeRawString(str)
    if (!enumValues) return { canonical: str, valid: true, original: str }
    if (enumValues.includes(lower)) return { canonical: lower, valid: true, original: str }
    const alias = attributeAwareAlias(attribute, lower)
    if (alias === 'unknown') return { canonical: null, valid: false, warning: 'Unknown value requires review', original: str }
    if (alias && enumValues.includes(alias)) return { canonical: alias, valid: false, warning: `Non-canonical value mapped from ${str}`, original: str }
    return { canonical: null, valid: false, warning: `Non-canonical value: ${str}`, original: str }
  }

  const rawValues: any[] | null = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.value)
      ? raw.value
      : attribute === 'details' && typeof (raw?.value ?? raw) === 'string'
        ? detailsFromString(String(raw?.value ?? raw))
        : null
  if (rawValues) {
    const normalized: Array<{ canonical: string | null; valid: boolean; warning?: string; original: string }> = rawValues.map(normalizeOne)
    const canonical = Array.from(new Set(normalized.map((n) => n.canonical).filter(Boolean) as string[]))
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
