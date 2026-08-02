import { readFileSync } from 'node:fs'

// Lightweight source-level guard because repo is TypeScript/Next without a test runner.
const constants = readFileSync(new URL('../lib/axis-validation/constants.ts', import.meta.url), 'utf8')
const normalization = readFileSync(new URL('../lib/axis-validation/normalization.ts', import.meta.url), 'utf8')

const mustInclude = [
  "'belted'", "'lurex'", "'wide-leg'", "'peach'", "'baby-blue'", "'bolero'", "'bandeau'", "'snood'", "'boat'", "'n/a'", "'swirl'", "'baroque'", "'pinstripe'", "'topstitched'", "'gold-hardware'", "'spaghetti-strap'", "'sheath'", "'trumpet'"
]
const forbiddenMappings = [
  "peach: 'coral'",
  "lurex: 'sequin'",
  "'wide-leg': 'flared'",
  "belted: 'draped'",
]
for (const token of mustInclude) {
  if (!constants.includes(token) && !normalization.includes(token)) throw new Error(`missing v8.3 token ${token}`)
}
for (const mapping of forbiddenMappings) {
  if (normalization.includes(mapping)) throw new Error(`forbidden mapping still present: ${mapping}`)
}
for (const required of ["detailsFromString", "belted", "beaded cuffs", "floor-length", "hip-length", "knee-length", "above-knee", "waist-length"]) {
  if (!normalization.includes(required)) throw new Error(`missing normalization guard ${required}`)
}
console.log('v8.3 normalization source guards PASS')
