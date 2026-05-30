'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, AlertTriangle, Check, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { AXES, VIBES, canonicalizeVibe, type AxisId, type VibeId } from '@/lib/axis-validation/constants'
import { AXIS_RUBRICS, AXIS_RUBRIC_VERSION } from '@/lib/axis-validation/rubric'
import { loadValidationData, type QaSummary, type ValidationItem } from '@/lib/axis-validation/loadData'
import { resolveImage } from '@/lib/axis-validation/imageResolver'
import { confidenceTier, getEnumForAttribute, normalizeValue } from '@/lib/axis-validation/normalization'
import type { ComponentReview, ExtractionComponent, ProductReview, SearchMatchReason, VibeBoostSuggestion, VibeReview } from '@/lib/axis-validation/types'
import './validation.css'

const issueOptions = ['wrong_image','image_mapping_failed','metadata_image_conflict','wrong_category','wrong_vibe','wrong_axis_score','wrong_hard_attribute','glamour_underweighted','glamour_overweighted','cultural_richness_underweighted','body_awareness_wrong','material_uncertain','image_ambiguous','confidence_too_high','auto_false_positive','prompt_issue','taxonomy_issue','manual_review_needed']
const feedbackTypes = ['none','axis_underweight','axis_overweight','wrong_vibe_mapping','bad_attribute_extraction','image_ambiguity','metadata_image_conflict','taxonomy_issue']
const EXCLUDED_BRANDS = ['Shahin Mannan', 'Surily G']
const EXCLUSION_LABEL = '74 lookbook products excluded pending CSV/image-source repair + re-extraction'
const REVIEW_STORAGE_KEY = 'gtf-axis-reviews'
const REVIEW_ACCESS_KEY = 'gtf-axis-review-access-token'

type ServerSaveState = { ok: boolean; writable: boolean; mode: string; message: string; lastSavedAt?: string; summary?: any }

function reviewTime(review: any) {
  return Date.parse(review?.reviewed_at ?? review?.updated_at ?? 0) || 0
}

function mergeReviewMaps(local: Record<string, ProductReview>, server: Record<string, ProductReview>) {
  const merged: Record<string, ProductReview> = { ...local }
  for (const [productId, serverReview] of Object.entries(server ?? {})) {
    const localReview = merged[productId]
    merged[productId] = reviewTime(serverReview) >= reviewTime(localReview) ? serverReview : localReview
  }
  return merged
}

function approvedAttributeProducts(reviews: Record<string, ProductReview>) {
  return Object.values(reviews).filter((r) => {
    const rows = r.attribute_reviews ?? []
    return rows.length > 0 && rows.every((a: any) => ['accept', 'accept_normalized', 'override'].includes(a.decision))
  }).length
}

function blankReview(item: ValidationItem): ProductReview {
  const image = resolveImage(item.product)
  return {
    product_id: item.product.product_id,
    reviewer: 'RK',
    review_status: 'draft',
    image_status: image.status,
    selected_image_path: image.src,
    image_resolution_status: image.status === 'ambiguous' ? 'pending' : image.status === 'missing' ? 'unresolved' : 'not_needed',
    overall_decision: 'unset',
    issue_tags: [],
    vibe_reviews: [],
    vibe_boost_suggestions: [],
    axis_overrides: [],
    attribute_reviews: [],
    component_reviews: [],
    prompt_feedback: { needs_prompt_update: false, issue_type: 'none', note: '' },
  }
}

export default function ValidationWorkbench() {
  const [items, setItems] = useState<ValidationItem[]>([])
  const [qa, setQa] = useState<QaSummary | null>(null)
  const [index, setIndex] = useState(0)
  const [reviews, setReviews] = useState<Record<string, ProductReview>>({})
  const [brand, setBrand] = useState('all')
  const [tier, setTier] = useState('all')
  const [category, setCategory] = useState('all')
  const [queue, setQueue] = useState('all')
  const [datasetVersion, setDatasetVersion] = useState<'v8.2' | 'v8.3'>(() => {
    if (typeof window === 'undefined') return 'v8.3'
    return new URLSearchParams(window.location.search).get('version') === 'v8.2' ? 'v8.2' : 'v8.3'
  })
  const [query, setQuery] = useState('')
  const [showQa, setShowQa] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [reviewerName, setReviewerName] = useState('RK')
  const [saveNotice, setSaveNotice] = useState('')
  const [reviewAccessToken, setReviewAccessToken] = useState(() => typeof window === 'undefined' ? '' : localStorage.getItem(REVIEW_ACCESS_KEY) || '')
  const [serverSave, setServerSave] = useState<ServerSaveState>({ ok: false, writable: false, mode: 'loading', message: 'Checking server persistence…' })
  const [hydrated, setHydrated] = useState(false)
  const lastServerSaveSignature = useRef('')
  const latestReviewSignature = useRef('')
  const hasUserEdited = useRef(false)

  function reviewApiHeaders(extra: Record<string, string> = {}) {
    return reviewAccessToken ? { ...extra, 'x-taste-lab-review-token': reviewAccessToken } : extra
  }

  useEffect(() => {
    loadValidationData(datasetVersion).then(async ({ items, qa }) => {
      setItems(items)
      setQa(qa)
      const saved = localStorage.getItem(REVIEW_STORAGE_KEY)
      const savedReviewer = localStorage.getItem('gtf-axis-reviewer')
      if (savedReviewer) setReviewerName(savedReviewer)
      const localReviews = saved ? JSON.parse(saved) : {}
      try {
        const response = await fetch('/api/reviews', { cache: 'no-store', headers: reviewApiHeaders() })
        const server = await response.json()
        const serverReviews = server?.reviews ?? {}
        const merged = mergeReviewMaps(localReviews, serverReviews)
        const mergedSignature = JSON.stringify(merged)
        lastServerSaveSignature.current = mergedSignature
        latestReviewSignature.current = mergedSignature
        hasUserEdited.current = false
        setReviews(merged)
        if (Object.keys(merged).length) localStorage.setItem(REVIEW_STORAGE_KEY, mergedSignature)
        setServerSave({ ok: Boolean(server?.ok), writable: Boolean(server?.writable), mode: server?.mode ?? 'unknown', message: server?.writable ? 'Server persistence ON' : `Server persistence unavailable: ${server?.error ?? 'unknown'}`, summary: server?.summary })
      } catch (error: any) {
        setReviews(localReviews)
        setServerSave({ ok: false, writable: false, mode: 'localStorage', message: `Local-only fallback: ${error?.message ?? error}` })
      } finally {
        setHydrated(true)
      }
    })
  }, [reviewAccessToken, datasetVersion])

  useEffect(() => {
    if (!hydrated) return
    const signature = JSON.stringify(reviews)
    latestReviewSignature.current = signature
    if (Object.keys(reviews).length) localStorage.setItem(REVIEW_STORAGE_KEY, signature)
  }, [hydrated, reviews])

  useEffect(() => {
    if (!hydrated) return
    const count = Object.keys(reviews).length
    if (!count || !hasUserEdited.current) return
    const reviewSignature = JSON.stringify(reviews)
    if (reviewSignature === lastServerSaveSignature.current) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: reviewApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ source: 'taste_lab_autosave', reviewer: reviewerName, reviews }),
          signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok || !result?.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
        lastServerSaveSignature.current = reviewSignature
        if (latestReviewSignature.current === reviewSignature) hasUserEdited.current = false
        setServerSave({ ok: true, writable: true, mode: result.mode ?? 'file', message: `Server autosaved ${count} review records`, lastSavedAt: new Date().toISOString(), summary: result.summary })
      } catch (error: any) {
        if (error?.name === 'AbortError') return
        setServerSave({ ok: false, writable: false, mode: 'localStorage', message: `Server unavailable — local browser copy only. Export JSON before refresh: ${error?.message ?? error}` })
      }
    }, 30000)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [hydrated, reviewerName, reviews, reviewAccessToken])

  useEffect(() => {
    localStorage.setItem('gtf-axis-reviewer', reviewerName)
  }, [reviewerName])

  useEffect(() => {
    if (reviewAccessToken) localStorage.setItem(REVIEW_ACCESS_KEY, reviewAccessToken)
    else localStorage.removeItem(REVIEW_ACCESS_KEY)
  }, [reviewAccessToken])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(filtered.length - 1, i + 1))
      if (e.key.toLowerCase() === 'a') setDecision('approve')
      if (e.key.toLowerCase() === 'd') setDecision('needs_correction')
      if (e.key.toLowerCase() === 's') setDecision('skip_for_now')
      if (e.key.toLowerCase() === 'e') exportJson()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const activeItems = useMemo(() => items.filter((i) => !EXCLUDED_BRANDS.includes(i.product.brand)), [items])
  const excludedCount = items.length - activeItems.length
  const brands = useMemo(() => Array.from(new Set(activeItems.map((i) => i.product.brand))).sort(), [activeItems])
  const categoryLabel = (item: ValidationItem) => item.extraction.brand_category || item.product.category || item.extraction.category || item.extraction.hard_attributes?.category?.value || 'Uncategorized'
  const normalizeCategoryKey = (value: string) => value.toLowerCase().replace(/\s*&\s*/g, '/').replace(/\s+/g, ' ').trim()
  const categories = useMemo(() => Array.from(new Set(activeItems.map(categoryLabel))).sort(), [activeItems])
  const categoryCounts = useMemo(() => activeItems.reduce<Record<string, number>>((acc, item) => {
    const label = categoryLabel(item)
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {}), [activeItems])
  const TOD_SAMPLE_TARGETS: Record<string, number> = {
    'dresses': 15,
    'cardigans': 10,
    'skirts': 10,
    'sweaters': 8,
    'tank tops': 7,
    'pants': 6,
    'clothing tops': 5,
    'scarves/shawls': 3,
    'shirts': 2,
    'outerwear': 999,
    'overcoats': 999,
    'crop tops': 999,
  }
  const sampleTargetForCategory = (label: string) => TOD_SAMPLE_TARGETS[normalizeCategoryKey(label)] ?? null
  const selectedCategoryTarget = category === 'all' ? null : sampleTargetForCategory(category)
  const categoryOptionLabel = (label: string) => {
    const target = sampleTargetForCategory(label)
    const targetCopy = target === 999 ? 'review all' : target ? `target ${target}` : 'CTO judgement'
    return `${label} (${categoryCounts[label] ?? 0}; ${targetCopy})`
  }
  const unresolvedImageIssueIds = useMemo(() => new Set((qa?.imageIssues ?? []).filter((i) => {
    if (EXCLUDED_BRANDS.includes(i.brand)) return false
    const r = reviews[i.product_id]
    return !(r?.image_resolution_status === 'approved' && r.selected_image_path) && r?.image_resolution_status !== 'no_valid_candidate'
  }).map((i) => i.product_id)), [qa, reviews])
  const approvedImageIds = useMemo(() => new Set(Object.values(reviews).filter((r) => r.image_resolution_status === 'approved').map((r) => r.product_id)), [reviews])
  const failedImageIds = useMemo(() => new Set(Object.values(reviews).filter((r) => r.image_resolution_status === 'no_valid_candidate').map((r) => r.product_id)), [reviews])
  const isMultiPiece = (item: ValidationItem) => Boolean(item.extraction.is_multi_piece || (item.extraction.components?.length ?? 0) > 0)
  const singleCount = activeItems.filter((item) => !isMultiPiece(item)).length
  const multiCount = activeItems.filter(isMultiPiece).length
  const filtered = useMemo(() => activeItems.filter((item) => {
    if (queue === 'single_garments' && isMultiPiece(item)) return false
    if (queue === 'multi_piece' && !isMultiPiece(item)) return false
    if (queue === 'image_unresolved' && !unresolvedImageIssueIds.has(item.product.product_id)) return false
    if (queue === 'image_approved' && !approvedImageIds.has(item.product.product_id)) return false
    if (queue === 'image_failed' && !failedImageIds.has(item.product.product_id)) return false
    if (brand !== 'all' && item.product.brand !== brand) return false
    if (tier !== 'all' && item.extraction.product_tier !== tier) return false
    if (category !== 'all' && categoryLabel(item) !== category) return false
    const q = query.toLowerCase().trim()
    if (q && !`${item.product.product_id} ${item.product.title} ${item.product.brand}`.toLowerCase().includes(q)) return false
    return true
  }), [activeItems, approvedImageIds, brand, category, failedImageIds, queue, tier, query, unresolvedImageIssueIds])

  const item = filtered[Math.min(index, Math.max(0, filtered.length - 1))]
  const review = item ? reviews[item.product.product_id] ?? blankReview(item) : null
  const activeProductIds = useMemo(() => new Set(activeItems.map((i) => i.product.product_id)), [activeItems])
  const activeReviewList = useMemo(() => Object.values(reviews).filter((r) => activeProductIds.has(r.product_id)), [activeProductIds, reviews])
  const activeReviewMap = useMemo(() => Object.fromEntries(activeReviewList.map((r) => [r.product_id, r])), [activeReviewList])
  const reviewedCount = activeReviewList.filter((r) => r.review_status === 'completed').length
  const skippedCount = activeReviewList.filter((r) => r.review_status === 'skipped').length
  const touchedCount = activeReviewList.length
  const attributeApprovedCount = approvedAttributeProducts(activeReviewMap)
  const attributeTouchedCount = activeReviewList.filter((r) => (r.attribute_reviews ?? []).length > 0).length
  const filteredReviewedCount = filtered.filter((i) => reviews[i.product.product_id]?.review_status === 'completed').length
  const progressPct = activeItems.length ? Math.round(((reviewedCount + skippedCount) / activeItems.length) * 100) : 0
  const correctionCount = activeReviewList.filter((r) => r.overall_decision === 'needs_correction' || r.axis_overrides.length || r.attribute_reviews.length || r.vibe_reviews.some((v) => v.decision === 'disagree')).length
  const vibeDisagreementCount = activeReviewList.reduce((sum, r) => sum + r.vibe_reviews.filter((v) => v.decision === 'disagree').length, 0)
  const vibeBoostCount = activeReviewList.reduce((sum, r) => sum + (r.vibe_boost_suggestions ?? []).length, 0)
  const axisOverrideCount = activeReviewList.reduce((sum, r) => sum + r.axis_overrides.length, 0)
  const unresolvedImageIssues = qa?.imageIssues.filter((i) => unresolvedImageIssueIds.has(i.product_id)) ?? []
  const imageIssueCount = unresolvedImageIssues.length
  const autoFalse = Object.values(reviews).filter((r) => items.find((i) => i.product.product_id === r.product_id)?.extraction.product_tier === 'AUTO' && r.overall_decision !== 'approve' && r.overall_decision !== 'unset').length
  const persistenceReady = serverSave.writable === true

  function blockUnsafeReviewAction(action = 'Review change') {
    setSaveNotice(`${action} blocked — server persistence is not writable. Export/import is allowed, but AR review must stay frozen.`)
    window.setTimeout(() => setSaveNotice(''), 3200)
  }

  function saveReview(next: ProductReview) {
    if (!persistenceReady) {
      blockUnsafeReviewAction('Review edit')
      return
    }
    hasUserEdited.current = true
    setReviews((prev) => ({ ...prev, [next.product_id]: { ...next, reviewer: reviewerName || 'anonymous' } }))
  }
  function setDecision(decision: ProductReview['overall_decision']) {
    if (!persistenceReady) {
      blockUnsafeReviewAction('Decision')
      return
    }
    if (!item || !review) return
    const status = decision === 'skip_for_now' ? 'skipped' : 'completed'
    saveReview({ ...review, overall_decision: decision, review_status: status, reviewed_at: new Date().toISOString() })
    setSaveNotice(`${decision.replaceAll('_', ' ')} saved for ${item.product.product_id}`)
    window.setTimeout(() => setSaveNotice(''), 1800)
    window.setTimeout(() => setIndex((i) => Math.min(filtered.length - 1, i + 1)), 260)
  }
  function jumpToProduct(productId: string) {
    const targetIndex = activeItems.findIndex((i) => i.product.product_id === productId)
    if (targetIndex < 0) return
    setBrand('all')
    setTier('all')
    setQuery('')
    setQueue('all')
    setIndex(targetIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function enrichedReview(r: ProductReview) {
    const source = items.find((i) => i.product.product_id === r.product_id)
    return {
      ...r,
      brand: source?.product.brand ?? '',
      title: source?.product.title ?? '',
      product_category: source?.product.category ?? '',
      extraction_category: source?.extraction.hard_attributes.category?.value ?? '',
      brand_category: source?.extraction.brand_category ?? source?.product.category ?? '',
      is_multi_piece: source?.extraction.is_multi_piece ?? ((source?.extraction.components?.length ?? 0) > 1),
      component_count: source?.extraction.component_count ?? source?.extraction.components?.length ?? 0,
      components: source?.extraction.components ?? [],
      search_terms: source?.extraction.search_terms ?? [],
      component_reviews: r.component_reviews ?? [],
      product_tier: source?.extraction.product_tier ?? '',
      price: source?.product.price ?? null,
      currency: source?.product.currency ?? null,
      product_image_file: source?.product.image_file ?? '',
      resolved_primary_image_path: source ? resolveImage(source.product).src ?? '' : '',
      resolved_secondary_image_path: source ? resolveImage(source.product).candidates[1]?.src ?? '' : '',
      image_candidate_paths: source ? resolveImage(source.product).candidates.map((c) => c.src) : [],
      image_resolution_status: r.image_resolution_status ?? 'not_needed',
      image_resolution_reviewer: r.image_resolution_reviewer ?? '',
      image_resolution_reviewed_at: r.image_resolution_reviewed_at ?? '',
      image_resolution_note: r.image_resolution_note ?? '',
      prompt_guard_version: (source?.extraction as any)?.meta?.prompt_guard_version ?? source?.extraction.schema_version ?? 'unknown',
      axis_rubric_version: AXIS_RUBRIC_VERSION,
      analysis_keys: {
        category_issue_tags: (r.issue_tags ?? []).map((tag) => `${source?.product.category ?? 'unknown'}::${tag}`),
        category_axis_overrides: (r.axis_overrides ?? []).map((o) => `${source?.product.category ?? 'unknown'}::${o.axis_id}`),
        category_attribute_reviews: (r.attribute_reviews ?? []).map((a) => `${source?.product.category ?? 'unknown'}::${a.attribute}`),
        brand_issue_tags: (r.issue_tags ?? []).map((tag) => `${source?.product.brand ?? 'unknown'}::${tag}`),
      },
    }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(Object.values(reviews).map(enrichedReview), null, 2)], { type: 'application/json' })
    downloadBlob(blob, `gtf-axis-reviews-${new Date().toISOString().slice(0,10)}.json`)
  }
  async function persistNow(nextReviews = reviews, source = 'manual_save') {
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: reviewApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ source, reviewer: reviewerName, reviews: nextReviews }),
    })
    const result = await response.json()
    if (!response.ok || !result?.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
    const savedSignature = JSON.stringify(nextReviews)
    lastServerSaveSignature.current = savedSignature
    latestReviewSignature.current = savedSignature
    hasUserEdited.current = false
    setServerSave({ ok: true, writable: true, mode: result.mode ?? 'file', message: `Server saved ${Object.keys(nextReviews).length} review records`, lastSavedAt: new Date().toISOString(), summary: result.summary })
    return result
  }

  function importReviewFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '{}'))
        const importedRaw = Array.isArray(parsed) ? Object.fromEntries(parsed.filter((r: any) => r?.product_id).map((r: any) => [r.product_id, r])) : (parsed.reviews ?? parsed)
        const imported = mergeReviewMaps(reviews, importedRaw)
        hasUserEdited.current = true
        setReviews(imported)
        localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(imported))
        await persistNow(imported, 'manual_import')
        setSaveNotice(`Imported ${Object.keys(importedRaw ?? {}).length} review records and saved to server`)
        window.setTimeout(() => setSaveNotice(''), 2500)
      } catch (error: any) {
        setServerSave({ ok: false, writable: false, mode: 'import_error', message: `Import failed: ${error?.message ?? error}` })
      }
    }
    reader.readAsText(file)
  }

  function exportCsv() {
    const rows = Object.values(reviews).map((r) => {
      const source = items.find((i) => i.product.product_id === r.product_id)
      return {
        product_id: r.product_id,
        brand: source?.product.brand ?? '',
        title: source?.product.title ?? '',
        product_category: source?.product.category ?? '',
        extraction_category: source?.extraction.hard_attributes.category?.value ?? '',
        brand_category: source?.extraction.brand_category ?? source?.product.category ?? '',
        is_multi_piece: source?.extraction.is_multi_piece ?? ((source?.extraction.components?.length ?? 0) > 1),
        component_count: source?.extraction.component_count ?? source?.extraction.components?.length ?? 0,
        components_json: JSON.stringify(source?.extraction.components ?? []),
        search_terms: (source?.extraction.search_terms ?? []).join('|'),
        component_reviews_json: JSON.stringify(r.component_reviews ?? []),
        product_tier: source?.extraction.product_tier ?? '',
        product_image_file: source?.product.image_file ?? '',
        resolved_primary_image_path: source ? resolveImage(source.product).src ?? '' : '',
        resolved_secondary_image_path: source ? resolveImage(source.product).candidates[1]?.src ?? '' : '',
        image_candidate_paths: source ? resolveImage(source.product).candidates.map((c) => c.src).join('|') : '',
        review_status: r.review_status,
        reviewed_at: r.reviewed_at ?? '',
        image_status: r.image_status,
        selected_image_path: r.selected_image_path ?? '',
        image_resolution_status: r.image_resolution_status ?? 'not_needed',
        image_resolution_reviewer: r.image_resolution_reviewer ?? '',
        image_resolution_reviewed_at: r.image_resolution_reviewed_at ?? '',
        image_resolution_note: r.image_resolution_note ?? '',
        overall_decision: r.overall_decision,
        issue_tags: r.issue_tags.join('|'),
        vibe_reviews_json: JSON.stringify(r.vibe_reviews),
        vibe_disagreements: r.vibe_reviews.filter((v) => v.decision === 'disagree').length,
        axis_overrides_json: JSON.stringify(r.axis_overrides),
        axis_override_count: r.axis_overrides.length,
        attribute_reviews_json: JSON.stringify(r.attribute_reviews),
        attribute_review_count: r.attribute_reviews.length,
        vibe_boost_suggestions_json: JSON.stringify(r.vibe_boost_suggestions ?? []),
        vibe_boost_suggestion_count: (r.vibe_boost_suggestions ?? []).length,
        prompt_needs_update: r.prompt_feedback.needs_prompt_update,
        prompt_issue_type: r.prompt_feedback.issue_type,
        prompt_note: r.prompt_feedback.note,
        prompt_guard_version: (source?.extraction as any)?.meta?.prompt_guard_version ?? source?.extraction.schema_version ?? 'unknown',
        axis_rubric_version: AXIS_RUBRIC_VERSION,
        category_issue_tags: r.issue_tags.map((tag) => `${source?.product.category ?? 'unknown'}::${tag}`).join('|'),
        category_axis_overrides: r.axis_overrides.map((o) => `${source?.product.category ?? 'unknown'}::${o.axis_id}`).join('|'),
        category_attribute_reviews: r.attribute_reviews.map((a) => `${source?.product.category ?? 'unknown'}::${a.attribute}`).join('|'),
        brand_issue_tags: r.issue_tags.map((tag) => `${source?.product.brand ?? 'unknown'}::${tag}`).join('|'),
      }
    })
    const header = Object.keys(rows[0] ?? { product_id: '', overall_decision: '' })
    const csv = [header.join(','), ...rows.map((row) => header.map((h) => JSON.stringify((row as any)[h] ?? '')).join(','))].join('\n')
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `gtf-axis-reviews-${new Date().toISOString().slice(0,10)}.csv`)
  }

  if (!item || !review) return <div className="loading">Loading GTF Axis Validation…</div>

  const image = resolveImage(item.product)
  const isTodAttributeQa = item.product.brand === 'Try On Dress'
  const radar = AXES.map((axis) => {
    const override = review.axis_overrides.find((o) => o.axis_id === axis.id)
    return { axis: axis.label.replace(' ', '\n'), original: item.extraction.axis_scores[axis.id]?.score ?? 0, override: override?.override_score ?? item.extraction.axis_scores[axis.id]?.score ?? 0 }
  })

  return (
    <main className="workbench">
      <header className="topbar">
        <div>
          <div className="brand-lockup"><span className="gtf-logo">GTF</span><span className="lab-pill">Taste Lab v2</span></div>
          <p className="eyebrow">{datasetVersion} · Category Context + Component Extraction Studio</p>
          <h1>Calibrate GTF’s Taste Engine</h1>
          <p className="subtitle">Review Source Truth images, brand category, {datasetVersion} component extraction, hard-gate attributes, search terms, match reasons, and correction notes in one studio. v8.3 is staged file/export-only; no production or Supabase writes.</p>
        </div>
        <div className="metrics expanded">
          <Metric label="Active products" value={activeItems.length} />
          <Metric label="Reviewed" value={reviewedCount} />
          <Metric label="Attribute approved" value={attributeApprovedCount} />
          {!isTodAttributeQa && <Metric label="Vibe disagreements" value={vibeDisagreementCount} />}
          {!isTodAttributeQa && <Metric label="Also-rank-high" value={vibeBoostCount} />}
          <Metric label="Axis overrides" value={axisOverrideCount} />
          <Metric label="Attr touched" value={attributeTouchedCount} />
          <Metric label={`${datasetVersion} ready`} value={qa?.readyVersionCount ?? qa?.v82Ready ?? 0} />
        </div>
      </header>

      {saveNotice && <div className="save-notice"><Check size={16}/>{saveNotice} · moving to next</div>}

      <section className={persistenceReady ? 'persistence-strip persistence-ok' : 'persistence-strip persistence-risk'}>
        <b>{persistenceReady ? 'Persistent review saving enabled' : 'P0 HARD BLOCK: review actions frozen'}</b>
        <span>{serverSave.message}{serverSave.lastSavedAt ? ` · ${new Date(serverSave.lastSavedAt).toLocaleTimeString()}` : ''}. Attribute-approved products: {attributeApprovedCount}. Autosave is throttled to 30s and snapshots are manual/import only; export JSON before refresh if the banner turns red.</span>
      </section>

      <section className="toolbar taste-toolbar">
        <select value={datasetVersion} onChange={(e) => { setDatasetVersion(e.target.value as 'v8.2' | 'v8.3'); setBrand('all'); setCategory('all'); setQueue('all'); setTier('all'); setQuery(''); setIndex(0); setReviews({}) }}><option value="v8.3">v8.3 staged — AFROPOP + TOD vibes</option><option value="v8.2">v8.2 TOD baseline</option></select>
        <input placeholder="Search products, brands, SKUs…" value={query} onChange={(e) => { setQuery(e.target.value); setIndex(0) }} />
        <select value={brand} onChange={(e) => { setBrand(e.target.value); setIndex(0) }}><option value="all">All brands</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>
        <select value={tier} onChange={(e) => { setTier(e.target.value); setIndex(0) }}><option value="all">All pipeline tiers</option><option>AUTO</option><option>REVIEW</option><option>MANUAL</option></select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setIndex(0) }}><option value="all">All categories — choose one for TOD sample</option>{categories.map((c) => <option key={c} value={c}>{categoryOptionLabel(c)}</option>)}</select>
        <select value={queue} onChange={(e) => { setQueue(e.target.value); setIndex(0) }}><option value="all">All active products</option><option value="single_garments">Single garments first ({singleCount})</option><option value="multi_piece">Multi-piece review ({multiCount})</option><option value="image_unresolved">Unresolved ambiguous photos ({unresolvedImageIssues.length})</option><option value="image_approved">Approved images ({approvedImageIds.size})</option><option value="image_failed">Manual image fix ({failedImageIds.size})</option></select>
        <button className="ghost soft-action" onClick={() => setShowQa(!showQa)}><SlidersHorizontal size={16}/> Data QA</button>
        <button className="ghost soft-action" onClick={() => setShowShortcuts(!showShortcuts)}>⌘ Shortcuts</button>
        <label className="reviewer-field"><span>Reviewer</span><input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} /></label>
        <label className="reviewer-field"><span>Access key</span><input type="password" value={reviewAccessToken} onChange={(e) => setReviewAccessToken(e.target.value.trim())} placeholder="Required for server save" /></label>
        <button className="ghost soft-action" onClick={() => persistNow().catch((error) => setServerSave({ ok: false, writable: false, mode: 'manual_save_error', message: `Manual save failed: ${error?.message ?? error}` }))}>Save server</button>
        <label className="ghost soft-action import-button"><input type="file" accept="application/json,.json" onChange={(e) => importReviewFile(e.target.files?.[0] ?? null)} />Import JSON</label>
        <button className="ghost soft-action" onClick={exportCsv}><Download size={16}/> CSV</button>
        <button className="primary gradient-action" onClick={exportJson}><Download size={16}/> Export JSON</button>
      </section>

      <section className="session-strip">
        <div className="session-copy"><b>Review session</b><span>{reviewerName || 'anonymous'} · {filteredReviewedCount}/{filtered.length} reviewed in current queue · {reviewedCount} completed, {skippedCount} skipped, {touchedCount} touched overall · {attributeApprovedCount} products with all explicit attributes approved · {excludedCount} lookbook products excluded pending source repair</span></div>
        <div className="progress-wrap"><div className="progress-label"><span>Batch progress</span><b>{progressPct}%</b></div><div className="progress-track"><div style={{ width: `${progressPct}%` }} /></div></div>
        <Badge tone={review.review_status === 'completed' ? 'green' : review.review_status === 'skipped' ? 'amber' : 'red'}>{review.review_status.toUpperCase()}</Badge>
      </section>

      {category !== 'all' && <section className="queue-banner"><b>Category filter: {category}</b><span>{filteredReviewedCount}/{filtered.length} reviewed in this filtered view. TOD prompt sample target: {selectedCategoryTarget === 999 ? 'review all rows in this small category' : selectedCategoryTarget ? `${selectedCategoryTarget} products` : 'use CTO judgement'}; stop early after ~10 clean rows with no new issue pattern, expand +5–10 only if recurring extraction errors appear.</span></section>}
      {category === 'all' && isTodAttributeQa && <section className="queue-banner"><b>TOD category sampling</b><span>Use the category dropdown first. Targets: Dresses 15, Cardigans 10, Skirts 10, Sweaters 8, Tank Tops 7, Pants 6, Clothing Tops 5, Scarves & Shawls 3, Shirts 2, and all small categories.</span></section>}
      {queue === 'single_garments' && <section className="queue-banner"><b>Single-garment review queue</b><span>Shows only products without component arrays. AR can safely continue normal extraction review here while multi-piece sets stay in their own queue.</span></section>}
      {queue === 'multi_piece' && <section className="queue-banner"><b>Multi-piece review queue</b><span>Shows pantsuits, co-ords, sets, saree/blouse, dress/cape and similar rows. Review component correctness before Variant C.</span></section>}
      {queue === 'image_unresolved' && <section className="queue-banner"><b>Image QA queue</b><span>Only unresolved ambiguous/missing images are shown. Approving selected image removes the product from this queue. If none match, send it to Manual image fix.</span></section>}

      {queue === 'image_failed' && <section className="queue-banner danger-banner"><b>Manual image fix queue</b><span>These products have no valid local image candidate. Do not validate attributes, axes, or vibes until source image mapping is repaired.</span></section>}

      {showQa && qa && <section className="qa"><b>Data QA:</b> {qa.totalProducts} source products / {activeItems.length} active products · {datasetVersion === 'v8.2' ? EXCLUSION_LABEL : 'v8.3 staged from reviewed Source Truth; AP/AP25/044 blocked upstream'} · {datasetVersion} ready {qa.readyVersionCount}/{qa.totalExtractions} · multi-piece {qa.multiPieceExtractions} · missing brand_category {qa.missingBrandCategory.length} · missing axes {qa.missingAxes} · invalid axis scores {qa.invalidAxisScores} · missing vibe scores {qa.missingVibeScores} · invalid vibe labels {qa.invalidVibes} · enum warnings {qa.invalidEnums.length} · unresolved image issues {unresolvedImageIssues.length} / original {qa.imageIssues.length} · images ok/url/ambiguous/missing {qa.imageStatusCounts.ok}/{qa.imageStatusCounts.url}/{qa.imageStatusCounts.ambiguous}/{qa.imageStatusCounts.missing}
        <details><summary>Image issues ({unresolvedImageIssues.length} unresolved)</summary><div className="qa-list clickable">{unresolvedImageIssues.slice(0,120).map((i) => <button type="button" key={i.product_id} onClick={() => jumpToProduct(i.product_id)}><b>{i.product_id}</b> · {i.brand} · {i.status} · {i.image_file}<br/><span>{i.message} · candidates: {i.candidates.slice(0,4).join(', ') || 'none'} · click to review</span></button>)}</div>{!unresolvedImageIssues.length && <p className="qa-resolved">All visible image issues are resolved in this browser session.</p>}</details>
        <details><summary>Missing brand_category ({qa.missingBrandCategory.length})</summary><div className="qa-list">{qa.missingBrandCategory.slice(0,160).map((id) => <div key={id}><b>{id}</b> · {datasetVersion} extraction should include brand_category before acceptance use.</div>)}</div></details>
        <details><summary>Enum warnings ({qa.invalidEnums.length})</summary><div className="qa-list">{qa.invalidEnums.slice(0,120).map((i, idx) => <div key={`${i.product_id}-${i.attribute}-${idx}`}><b>{i.product_id}</b> · {i.attribute}: {String(i.value)} · <span>{i.warning}</span></div>)}</div></details>
      </section>}

      {showShortcuts && <section className="qa shortcuts"><b>Keyboard shortcuts:</b> ← Previous · → Next · A Approve · D Needs correction · S Skip · E Export JSON. Inputs, selects, and textareas ignore shortcuts while focused.</section>}

      <section className="review-grid">
        <ProductImage item={item} image={image} review={review} saveReview={saveReview} reviewerName={reviewerName} queue={queue} persistenceReady={persistenceReady} onAdvance={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))} position={`${Math.min(index + 1, filtered.length)} / ${filtered.length}`} />
        <div className="review-panel">
          <Meta item={item} image={image} />
          <V82ExtractionPanel item={item} review={review} saveReview={saveReview} />
          <SearchLabPanel item={item} />
          <Decision review={review} saveReview={saveReview} setDecision={setDecision} persistenceReady={persistenceReady} />
          <VibePanel item={item} review={review} saveReview={saveReview} />
          <AxisPanel item={item} review={review} saveReview={saveReview} radar={radar} />
          <AttributePanel item={item} review={review} saveReview={saveReview} />
          <Reasoning item={item} review={review} saveReview={saveReview} />
        </div>
      </section>

      <footer className={queue === 'image_unresolved' ? "navrow image-mode" : "navrow"}>
        <button className="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))}><ChevronLeft size={16}/> Previous</button>
        {queue === 'image_unresolved' ? <span className="mode-copy">Image QA mode: approve image mapping in the image panel, or mark no valid candidate. Product approval is intentionally hidden.</span> : <>
          <button className="danger" disabled={!persistenceReady} onClick={() => setDecision('manual_escalation')}>Manual escalation</button>
          <button className="ghost" disabled={!persistenceReady} onClick={() => setDecision('skip_for_now')}>Skip</button>
          <button className="primary" disabled={!persistenceReady} onClick={() => setDecision('approve')}><Check size={16}/> Save + approve product</button>
        </>}
        <button className="ghost" onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}>Next <ChevronRight size={16}/></button>
      </footer>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

function ProductImage({ item, image, review, saveReview, position, reviewerName, queue, persistenceReady, onAdvance }: any) {
  const src = review.selected_image_path ?? image.src
  const selectedCandidate = image.candidates.find((c: any) => c.src === src)
  const isImageApproved = review.image_resolution_status === 'approved'
  const hasNoValidCandidate = review.image_resolution_status === 'no_valid_candidate'
  const selectImage = (candidate: any) => {
    const issueTags = review.issue_tags.includes('image_ambiguous') ? review.issue_tags : [...review.issue_tags, 'image_ambiguous']
    saveReview({
      ...review,
      selected_image_path: candidate.src,
      image_status: image.status,
      image_resolution_status: 'pending',
      image_resolution_reviewed_at: undefined,
      image_resolution_reviewer: undefined,
      issue_tags: image.status === 'ambiguous' ? issueTags : review.issue_tags,
    })
  }
  const approveSelectedImage = () => {
    if (!src) return
    const issueTags = review.issue_tags.includes('image_ambiguous') ? review.issue_tags : [...review.issue_tags, 'image_ambiguous']
    saveReview({
      ...review,
      selected_image_path: src,
      image_status: 'ok',
      image_resolution_status: 'approved',
      image_resolution_reviewer: reviewerName || 'anonymous',
      image_resolution_reviewed_at: new Date().toISOString(),
      issue_tags: image.status === 'ambiguous' ? issueTags : review.issue_tags,
    })
    if (queue === 'image_unresolved') window.setTimeout(onAdvance, 180)
  }
  const markNoValidCandidate = () => {
    const tags = Array.from(new Set([...review.issue_tags, 'wrong_image', 'image_mapping_failed', 'manual_review_needed']))
    saveReview({
      ...review,
      image_status: 'missing',
      image_resolution_status: 'no_valid_candidate',
      image_resolution_reviewer: reviewerName || 'anonymous',
      image_resolution_reviewed_at: new Date().toISOString(),
      image_resolution_note: review.image_resolution_note || 'No displayed candidate matches the product; source image mapping must be repaired before attribute/axis/vibe validation.',
      overall_decision: 'manual_escalation',
      reviewed_at: new Date().toISOString(),
      issue_tags: tags,
    })
    if (queue === 'image_unresolved') window.setTimeout(onAdvance, 180)
  }
  return <aside className="image-panel">
    <div className="image-head"><Badge tone={isImageApproved || image.status === 'ok' || image.status === 'url' ? 'green' : hasNoValidCandidate ? 'red' : image.status === 'ambiguous' ? 'amber' : 'red'}>{hasNoValidCandidate ? 'NO VALID IMAGE' : isImageApproved ? 'IMAGE APPROVED' : image.status.toUpperCase()}</Badge><span>{position}</span></div>
    {src ? <img src={src} alt={`${item.product.brand} ${item.product.title}`} /> : <div className="missing"><AlertTriangle/> Missing image</div>}
    {image.status === 'ambiguous' && <div className="candidate-box image-chooser"><div className="candidate-copy"><b>Ambiguous image — choose and approve exact product photo</b><p>{selectedCandidate ? `Selected: ${selectedCandidate.label}` : image.message}</p></div><div className="candidates">{image.candidates.slice(0,8).map((c: any) => <button key={c.src} className={src === c.src ? 'selected-candidate' : ''} onClick={() => selectImage(c)}><img src={c.src} alt={c.label}/><span>{c.label}</span><em>{src === c.src ? 'Selected' : c.confidence}</em></button>)}</div><div className="image-approval"><div className="image-actions"><button className={isImageApproved ? 'selected' : 'primary'} disabled={!persistenceReady || !selectedCandidate || isImageApproved || hasNoValidCandidate} onClick={approveSelectedImage}>{isImageApproved ? 'Selected image approved' : 'Approve selected image'}</button><button className="danger" disabled={!persistenceReady || hasNoValidCandidate} onClick={markNoValidCandidate}>None of these match product</button></div>{hasNoValidCandidate ? <span>Sent to Manual image fix · do not validate downstream fields yet.</span> : isImageApproved ? <span>Approved by {review.image_resolution_reviewer} · saved in export · auto-advances in Image QA queue</span> : <span>Selection is not resolved until approved.</span>}</div></div>}
    <div className="product-caption"><p className="caption-kicker">Now reviewing</p><h2>{item.product.title}</h2><p>{item.product.brand}</p><code>{item.product.product_id}</code></div>
  </aside>
}

function sourceTruthImageUrl(path?: string) {
  if (!path) return ''
  const driveMatch = path.match(/\/source-truth\/drive-image\/([^/?#]+)/)
  if (driveMatch?.[1]) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1400`
  return path.startsWith('/') ? `https://gtf-source-truth.onrender.com${path}` : path
}

function Meta({ item, image }: { item: ValidationItem; image: any }) {
  const primary = sourceTruthImageUrl(item.extraction.source_truth?.final_primary_image ?? item.extraction.final_primary_image) || image.src
  const secondary = sourceTruthImageUrl(item.extraction.source_truth?.final_secondary_image ?? item.extraction.final_secondary_image) || image.candidates?.[1]?.src
  return <section className="card"><div className="card-title"><h3>Product metadata</h3><Badge tone={item.extraction.product_tier === 'AUTO' ? 'green' : item.extraction.product_tier === 'REVIEW' ? 'amber' : 'red'}>Product tier: {item.extraction.product_tier}</Badge></div>
    <div className="meta-grid"><span>Catalog category</span><b>{item.product.category}</b><span>Brand category</span><b>{item.extraction.brand_category ?? item.product.category ?? '—'}</b><span>Extracted category</span><b>{item.extraction.hard_attributes.category?.value}</b><span>Schema</span><b>{item.extraction.schema_version}</b><span>Confidence</span><b>{item.extraction.confidence ?? '—'}</b><span>Review needed</span><b>{item.extraction.review_needed?.join(', ') || 'None'}</b><span>Manual needed</span><b>{item.extraction.manual_needed?.join(', ') || 'None'}</b><span>Catalog image ref</span><code>{item.product.image_file || '—'}</code><span>Source Truth primary</span>{primary ? <a href={primary} target="_blank">open final primary</a> : <b>—</b>}<span>Source Truth secondary</span>{secondary ? <a href={secondary} target="_blank">open final secondary</a> : <b>—</b>}</div>
  </section>
}

function componentRaw(component: ExtractionComponent, key: string) {
  if (key === 'category') return component.attributes?.category ?? { value: component.piece_type, confidence: component.confidence }
  return component.attributes?.[key] ?? (component as any)[key]
}

function componentValue(component: ExtractionComponent, key: string) {
  const value = componentRaw(component, key)
  if (Array.isArray(value)) return value.map((v) => typeof v === 'object' ? v?.value ?? JSON.stringify(v) : v).join(', ')
  if (value && typeof value === 'object') return value.value ?? JSON.stringify(value)
  return value ?? '—'
}

function V82ExtractionPanel({ item, review, saveReview }: { item: ValidationItem; review: ProductReview; saveReview: (r: ProductReview) => void }) {
  const extraction = item.extraction
  const versionLabel = extraction.schema_version ? `v${extraction.schema_version}` : 'v8.x'
  const components = extraction.components ?? []
  const isV82Ready = Boolean(extraction.brand_category || components.length || extraction.search_terms?.length || extraction.schema_version?.includes('8.2') || extraction.schema_version?.includes('8.3'))
  const componentAttrs = ['category','primary_color','secondary_color','material_primary','material','silhouette','length','neckline','sleeve_length','pattern','details']
  const updateComponentReview = (component: ExtractionComponent, patch: Partial<ComponentReview>) => {
    const existingReviews = review.component_reviews ?? []
    const current = existingReviews.find((r) => r.component_index === component.component_index)
    const nextReview: ComponentReview = {
      component_index: component.component_index,
      piece_type: component.piece_type,
      decision: 'unset',
      reason: '',
      ...current,
      ...patch,
    }
    saveReview({ ...review, component_reviews: [...existingReviews.filter((r) => r.component_index !== component.component_index), nextReview] })
  }
  const updateComponentAttributeReview = (component: ExtractionComponent, attr: string, patch: any) => {
    const existingReviews = review.component_reviews ?? []
    const current = existingReviews.find((r) => r.component_index === component.component_index) ?? { component_index: component.component_index, piece_type: component.piece_type, decision: 'unset' as const, reason: '', attribute_reviews: [] }
    const raw = componentRaw(component, attr)
    const rawValue = displayRawAttribute(attr, raw)
    const norm = normalizeValue(attr, raw)
    const attrReviews = current.attribute_reviews ?? []
    const existing = attrReviews.find((r) => r.attribute === attr)
    const nextAttr = { attribute: attr, raw_value: rawValue, canonical_suggestion: norm.canonical, decision: 'unset', override_value: attr === 'details' ? [] : null, reason: '', ...existing, ...patch }
    const nextReview: ComponentReview = { ...current, attribute_reviews: [...attrReviews.filter((r) => r.attribute !== attr), nextAttr] }
    saveReview({ ...review, component_reviews: [...existingReviews.filter((r) => r.component_index !== component.component_index), nextReview] })
  }
  return <section className="card v82-card"><div className="section-kicker">{versionLabel} extraction shape</div><div className="card-title"><h3>Brand category + components</h3><Badge tone={isV82Ready ? 'green' : 'red'}>{isV82Ready ? `${versionLabel.toUpperCase()} SIGNALS PRESENT` : 'MISSING STRUCTURAL SIGNALS'}</Badge></div>
    <div className="v82-summary"><div><span>brand_category</span><b>{extraction.brand_category ?? item.product.category ?? '—'}</b></div><div><span>is_multi_piece</span><b>{String(extraction.is_multi_piece ?? components.length > 1)}</b></div><div><span>component_count</span><b>{extraction.component_count ?? components.length}</b></div><div><span>search_terms</span><b>{extraction.search_terms?.length ?? 0}</b></div></div>
    {!extraction.brand_category && <p className="v82-warning">Blocked for acceptance: {versionLabel} requires brand_category so shared-image separates focus the target garment instead of the visually dominant garment.</p>}
    {extraction.extraction_error && <p className="v82-warning">Extraction error: <code>{extraction.extraction_error}</code></p>}
    {extraction.metadata_image_conflict?.has_conflict && <div className="conflict-box"><b>Metadata/image conflict</b><p>{extraction.metadata_image_conflict.visual_evidence ?? 'Conflict flagged; route to manual review.'}</p><small>{extraction.metadata_image_conflict.recommended_action}</small></div>}
    {components.length ? <div className="component-list">{components.map((component) => {
      const existing = (review.component_reviews ?? []).find((r) => r.component_index === component.component_index)
      return <div className="component-card" key={`${component.component_index}-${component.piece_type}`}><div className="component-head"><div><b>#{component.component_index} · {component.piece_type}</b><span>{component.role ?? 'component'} · review this piece’s own attributes, not the whole outfit</span></div><select value={existing?.decision ?? 'unset'} onChange={(e) => updateComponentReview(component, { decision: e.target.value as ComponentReview['decision'] })}><option value="unset">component unset</option><option value="accept">component accepted</option><option value="needs_correction">piece type needs correction</option><option value="not_visible">piece not visible</option><option value="manual_review">manual review</option></select></div><div className="component-attrs">{componentAttrs.map((key) => <div key={key}><span>{key}</span><b>{componentValue(component, key)}</b></div>)}</div><details className="component-attribute-review"><summary>Review attributes for {component.piece_type}</summary><p className="hint">Use this for AR’s multi-garment issue: top-level attributes describe the sellable set; these rows approve/correct each garment piece separately.</p>{componentAttrs.map((attr) => { const raw = componentRaw(component, attr); const rawValue = displayRawAttribute(attr, raw); const norm = normalizeValue(attr, raw); const attrReview = existing?.attribute_reviews?.find((r) => r.attribute === attr); const enums = getEnumForAttribute(attr); return <div className="component-attr-row" key={attr}><span>{attr}</span><b>{rawValue}</b><em className={norm.valid ? 'ok' : 'warn'}>{displayCanonical(norm.canonical) ?? norm.warning}</em><select value={attrReview?.decision ?? 'unset'} onChange={(e) => updateComponentAttributeReview(component, attr, { decision: e.target.value })}><option value="unset">unset</option><option value="accept">accept raw</option><option value="accept_normalized">accept normalized</option><option value="override">override</option><option value="needs_review">needs review</option></select>{attrReview?.decision === 'override' && enums && (attr === 'details' ? <select multiple value={attrReview.override_value ?? []} onChange={(e) => updateComponentAttributeReview(component, attr, { override_value: Array.from(e.currentTarget.selectedOptions).map((o) => o.value) })}>{enums.map((v) => <option key={v}>{v}</option>)}</select> : <select value={attrReview.override_value ?? ''} onChange={(e) => updateComponentAttributeReview(component, attr, { override_value: e.target.value })}><option value="">Choose canonical</option>{enums.map((v) => <option key={v}>{v}</option>)}</select>)}<input placeholder="component note" value={attrReview?.reason ?? ''} onChange={(e) => updateComponentAttributeReview(component, attr, { reason: e.target.value })}/></div>})}</details>{existing?.decision === 'needs_correction' && <input placeholder="Correct piece type, e.g. bralette not blouse" value={existing.corrected_piece_type ?? ''} onChange={(e) => updateComponentReview(component, { corrected_piece_type: e.target.value })}/>}<textarea placeholder="Component-level review note: visible evidence, missing piece, wrong target, etc." value={existing?.reason ?? ''} onChange={(e) => updateComponentReview(component, { reason: e.target.value })}/></div>
    })}</div> : <p className="hint">No components[] present yet. For set/co-ord/pantsuit products, {versionLabel} must add per-piece records before Taste Lab acceptance.</p>}
    {(extraction.search_terms ?? []).length > 0 && <div className="search-terms"><b>Search terms</b><div>{extraction.search_terms!.map((term) => <span key={term}>{term}</span>)}</div></div>}
  </section>
}

function findSearchMatches(item: ValidationItem, query: string): SearchMatchReason[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const extraction = item.extraction
  const matches: SearchMatchReason[] = []
  const add = (source: SearchMatchReason['source'], field: string, value: unknown, component?: ExtractionComponent) => {
    const text = String(value ?? '').toLowerCase()
    if (text.includes(q)) matches.push({ source, field, value: String(value), component_index: component?.component_index, piece_type: component?.piece_type })
  }
  add('top_level_category', 'brand_category', extraction.brand_category ?? item.product.category)
  add('top_level_category', 'hard_attributes.category', extraction.hard_attributes.category?.value)
  for (const component of extraction.components ?? []) {
    add('component_piece_type', 'piece_type', component.piece_type, component)
    for (const [field, raw] of Object.entries({ ...(component.attributes ?? {}), ...component })) {
      if (['component_index','piece_type','role','attributes'].includes(field)) continue
      add('component_attribute', field, Array.isArray(raw) ? raw.join(', ') : typeof raw === 'object' && raw ? (raw as any).value ?? JSON.stringify(raw) : raw, component)
    }
  }
  for (const term of extraction.search_terms ?? []) add('search_term', 'search_terms[]', term)
  return matches
}

function SearchLabPanel({ item }: { item: ValidationItem }) {
  const [searchQuery, setSearchQuery] = useState('')
  const exampleQuery = item.extraction.components?.[0]?.piece_type ?? item.extraction.search_terms?.[0] ?? item.extraction.brand_category ?? item.product.category
  const matches = findSearchMatches(item, searchQuery)
  return <section className="card search-lab-card"><div className="section-kicker">Search Lab</div><h3>Match reason debugger</h3><p className="hint">Tests whether search can explain why a result matched: top-level category, component piece_type, component attribute, or search term.</p><div className="search-lab-input"><input placeholder={`Try “${exampleQuery}”`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /><button className="ghost soft-action" onClick={() => setSearchQuery(exampleQuery)}>Use example</button></div>{searchQuery && <div className="match-list">{matches.length ? matches.map((match, idx) => <div key={`${match.source}-${match.field}-${idx}`}><Badge tone={match.source === 'search_term' ? 'green' : match.source.startsWith('component') ? 'amber' : 'red'}>{match.source.replaceAll('_',' ')}</Badge><b>{match.field}</b><span>{match.component_index ? `Component #${match.component_index} · ${match.piece_type}` : 'Top-level product'}</span><code>{match.value}</code></div>) : <p className="v82-warning">No match. If this is a sellable phrase, add it to search_terms[] or component attributes.</p>}</div>}</section>
}

function Decision({ review, saveReview, setDecision, persistenceReady }: any) {
  return <section className="card"><h3>Overall decision</h3>{!persistenceReady && <p className="p0-lock-copy">Review decisions are locked until server persistence is writable.</p>}<div className="button-grid">{['approve','needs_correction','manual_escalation','skip_for_now'].map((d) => <button key={d} disabled={!persistenceReady} className={review.overall_decision === d ? 'selected' : 'ghost'} onClick={() => setDecision(d)}>{d.replaceAll('_',' ')}</button>)}</div><div className="chips">{issueOptions.map((tag) => <button key={tag} disabled={!persistenceReady} className={review.issue_tags.includes(tag) ? 'chip active' : 'chip'} onClick={() => saveReview({ ...review, issue_tags: review.issue_tags.includes(tag) ? review.issue_tags.filter((t: string) => t !== tag) : [...review.issue_tags, tag] })}>{tag.replaceAll('_',' ')}</button>)}</div></section>
}

function VibePanel({ item, review, saveReview }: { item: ValidationItem; review: ProductReview; saveReview: (r: ProductReview) => void }) {
  const computed = Object.entries(item.extraction.all_vibe_scores ?? {}).sort((a,b) => (b[1]?.score ?? 0) - (a[1]?.score ?? 0)).slice(0, 12).map(([label, obj]) => ({ label, score: obj?.score ?? 0, source: 'computed' as const }))
  const gpt = (item.extraction.gpt_suggested_vibes ?? []).map((label) => ({ label, score: undefined, source: 'gpt' as const }))
  const pending = item.extraction.vibe_review_status === 'pending_ar_vibe_review'
  return <section className="card vibe-card"><div className="section-kicker">AI style alignment {pending ? '· pending AR vibe review' : ''}</div><h3>Suggested vibe validation</h3><p className="hint">Computed vector vibes and GPT suggestions are separate. For v8.3 AFROPOP + TOD these are visible for AR calibration only — not production-approved product truth until AR/Zoya signs off. Agree when the taste feels right; disagree only when the vibe is wrong. Use “Should also rank high” when another vibe deserves a boost without marking the current vibe wrong.</p>{pending && <p className="v82-warning">Vibe status: computed / pending AR approval. Do not treat as production-approved yet.</p>}{computed.length || gpt.length ? <div className="vibe-list">{[...computed.slice(0,3), ...gpt].map((v, idx) => <VibeRow key={`${v.source}-${v.label}-${idx}`} vibe={v} review={review} saveReview={saveReview} />)}</div> : <p className="v82-warning">No computed vibe scores found for this row yet. Review extraction/components first, then run the production vibe scoring pass.</p>}<VibeBoostPanel review={review} saveReview={saveReview}/>{computed.length > 0 && <details><summary>Show all computed vibe scores</summary>{computed.map((v) => <div key={v.label} className="score-row"><span>{v.label}</span><progress max={100} value={v.score}/><b>{v.score.toFixed(1)}</b></div>)}</details>}</section>
}


function VibeBoostPanel({ review, saveReview }: { review: ProductReview; saveReview: (r: ProductReview) => void }) {
  const boosts = review.vibe_boost_suggestions ?? []
  const addBoost = () => {
    const firstUnused = VIBES.find((v) => !boosts.some((b) => b.vibe_id === v.id)) ?? VIBES[0]
    const next: VibeBoostSuggestion = { vibe_id: firstUnused.id, label: firstUnused.label, reason: '', created_at: new Date().toISOString() }
    saveReview({ ...review, vibe_boost_suggestions: [...boosts, next] })
  }
  const updateBoost = (idx: number, patch: Partial<VibeBoostSuggestion>) => {
    const next = boosts.map((b, i) => {
      if (i !== idx) return b
      const vibe = patch.vibe_id ? VIBES.find((v) => v.id === patch.vibe_id) : undefined
      return { ...b, ...patch, label: vibe?.label ?? patch.label ?? b.label }
    })
    saveReview({ ...review, vibe_boost_suggestions: next })
  }
  const removeBoost = (idx: number) => saveReview({ ...review, vibe_boost_suggestions: boosts.filter((_, i) => i !== idx) })
  return <div className="vibe-boost-box"><div className="boost-head"><div><b>Should also rank high for…</b><p>This is calibration signal: the shown vibe can be right, while another canonical vibe should score closer/higher.</p></div><button className="ghost soft-action" onClick={addBoost}>Add vibe boost</button></div>{boosts.map((boost, idx) => <div className="boost-row" key={`${boost.vibe_id}-${idx}`}><select value={boost.vibe_id} onChange={(e) => updateBoost(idx, { vibe_id: e.target.value as VibeId })}>{VIBES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select><input placeholder="Why should it also rank high?" value={boost.reason} onChange={(e) => updateBoost(idx, { reason: e.target.value })}/><button className="ghost" onClick={() => removeBoost(idx)}>Remove</button></div>)}</div>
}

function VibeRow({ vibe, review, saveReview }: any) {
  const canonical = canonicalizeVibe(vibe.label)
  const id = canonical?.id ?? 'unique_finds'
  const existing = review.vibe_reviews.find((r: VibeReview) => r.vibe_id === id && r.source === vibe.source) as VibeReview | undefined
  const row = existing ?? { vibe_id: id, label: canonical?.label ?? vibe.label, source: vibe.source, original_score: vibe.score, decision: 'unset', correct_vibe_ids: [], reason: '' }
  const update = (patch: Partial<VibeReview>) => saveReview({ ...review, vibe_reviews: [...review.vibe_reviews.filter((r: VibeReview) => !(r.vibe_id === id && r.source === vibe.source)), { ...row, ...patch }] })
  return <div className="vibe-row"><div><b>{row.label}</b><span>{vibe.source}{typeof vibe.score === 'number' ? ` · ${vibe.score.toFixed(1)}` : ''}</span>{!canonical && <em>Unmapped label</em>}</div><div className="agree"><button className={row.decision === 'agree' ? 'yes' : 'ghost'} onClick={() => update({ decision: 'agree' })}>Agree</button><button className={row.decision === 'disagree' ? 'no' : 'ghost'} onClick={() => update({ decision: 'disagree' })}>Disagree</button></div>{row.decision === 'disagree' && <div className="correction"><select multiple value={row.correct_vibe_ids} onChange={(e) => update({ correct_vibe_ids: Array.from(e.currentTarget.selectedOptions).map((o) => o.value as VibeId) })}>{VIBES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select><textarea className="stylist-note" placeholder="Why do you disagree? e.g. Not Old Money because sequins and shine push it into Glam." value={row.reason} onChange={(e) => update({ reason: e.target.value })}/></div>}</div>
}

function AxisPanel({ item, review, saveReview, radar }: any) {
  return <section className="card axis-card"><div className="section-kicker">Editorial axis profile</div><h3>11-axis score review</h3><div className="radar"><ResponsiveContainer width="100%" height={260}><RadarChart data={radar}><PolarGrid/><PolarAngleAxis dataKey="axis" tick={{ fontSize: 10 }}/><PolarRadiusAxis angle={90} domain={[0,10]} tick={false}/><Radar dataKey="original" stroke="#7c6aef" fill="#7c6aef" fillOpacity={0.18}/><Radar dataKey="override" stroke="#0a0a0a" fill="#0a0a0a" fillOpacity={0.06}/></RadarChart></ResponsiveContainer></div>{AXES.map((axis) => <AxisRow key={axis.id} axis={axis} item={item} review={review} saveReview={saveReview}/>)}</section>
}
function AxisRow({ axis, item, review, saveReview }: any) {
  const original = item.extraction.axis_scores[axis.id]?.score ?? 0
  const existing = review.axis_overrides.find((o: any) => o.axis_id === axis.id)
  const value = existing?.override_score ?? original
  const rubric = AXIS_RUBRICS[axis.id as AxisId]
  const update = (score: number, reason = existing?.reason ?? '') => {
    const next = review.axis_overrides.filter((o: any) => o.axis_id !== axis.id)
    if (score !== original || reason) next.push({ axis_id: axis.id, label: axis.label, original_score: original, override_score: score, reason, rubric_version: AXIS_RUBRIC_VERSION })
    saveReview({ ...review, axis_overrides: next })
  }
  return <div className={existing ? 'axis-row modified' : 'axis-row'}>
    <div>
      <div className="axis-title"><b>{axis.label}</b><details className="axis-rubric"><summary>Rubric</summary><div className="rubric-popover"><p className="rubric-version">Axis Rubric {AXIS_RUBRIC_VERSION}</p><p><b>{rubric.question}</b></p><p>{rubric.measures}</p><div className="rubric-grid"><div><h4>Signals ↑</h4><ul>{rubric.increases.map((s) => <li key={s}>{s}</li>)}</ul></div><div><h4>Signals ↓</h4><ul>{rubric.decreases.map((s) => <li key={s}>{s}</li>)}</ul></div></div><table><tbody>{rubric.bands.map((b) => <tr key={b.range}><th>{b.range}</th><td><b>{b.label}</b><br/><span>{b.example}</span></td></tr>)}</tbody></table>{rubric.caps?.length ? <div className="rubric-caps"><b>Caps</b><ul>{rubric.caps.map((c) => <li key={c}>{c}</li>)}</ul></div> : null}{rubric.notes?.map((n) => <p key={n} className="rubric-note">{n}</p>)}</div></details></div>
      <span className="axis-definition"><b>Definition:</b> {rubric.measures} <em>{rubric.question}</em></span>
      <span>{item.extraction.axis_scores[axis.id]?.reasoning}</span>
    </div>
    <strong>{original} → {value}</strong>
    <input type="range" min={1} max={10} value={value} onChange={(e) => update(Number(e.target.value))}/>
    {value !== original && <textarea placeholder="Reference rubric signals: what visible evidence justifies this score change?" value={existing?.reason ?? ''} onChange={(e) => update(value, e.target.value)}/>}
  </div>
}

function displayRawAttribute(attr: string, raw: any) {
  if (attr === 'details') return (Array.isArray(raw) ? raw : raw?.value ?? []).map((d: any) => d?.value ?? d).filter(Boolean).join(', ') || '—'
  return raw?.value ?? raw ?? '—'
}

function displayCanonical(canonical: string | string[] | null) {
  if (Array.isArray(canonical)) return canonical.join(', ')
  return canonical ?? null
}

function AttributePanel({ item, review, saveReview }: any) {
  const attrs = ['category','primary_color','secondary_color','material_primary','material_secondary','material_source','silhouette','length','neckline','sleeve_length','pattern','details','price_tier']
  const acceptAllNormalized = () => {
    const next = [...review.attribute_reviews]
    for (const attr of attrs) {
      const raw = item.extraction.hard_attributes[attr]
      const rawValue = displayRawAttribute(attr, raw)
      if (rawValue === '—') continue
      const norm = normalizeValue(attr, raw)
      const existingIndex = next.findIndex((r: any) => r.attribute === attr)
      const existing = existingIndex >= 0 ? next[existingIndex] : undefined
      if (existing?.decision === 'override' || existing?.decision === 'needs_review') continue
      const decision = norm.canonical ? 'accept_normalized' : norm.valid ? 'accept' : 'needs_review'
      const record = {
        attribute: attr,
        override_value: attr === 'details' ? [] : null,
        reason: decision === 'needs_review' ? (norm.warning ?? 'Needs reviewer confirmation') : '',
        ...existing,
        decision,
        canonical_suggestion: norm.canonical,
        raw_value: rawValue,
      }
      if (existingIndex >= 0) next[existingIndex] = record
      else next.push(record)
    }
    saveReview({ ...review, attribute_reviews: next })
  }

  const isMultiPiece = Boolean(item.extraction.is_multi_piece || (item.extraction.components?.length ?? 0) > 0)
  return <section className="card"><div className="section-kicker">Structured product truth</div><div className="card-title"><h3>{isMultiPiece ? 'Top-level product attribute review' : 'Hard attribute review'}</h3><button className="ghost soft-action" onClick={acceptAllNormalized}>Accept all normalized attributes</button></div>{isMultiPiece ? <p className="v82-warning">Multi-piece rule: these top-level rows describe the sellable product/set only. Do not use top-level neckline, sleeve, or length as truth for every garment. Approve/correct per-piece attributes inside the Brand category + components card above.</p> : <p className="hint">This creates explicit audit rows. Untouched/unset fields still do not count as approval.</p>}<div className="attr-table">{attrs.map((a) => <AttributeRow key={a} attr={a} item={item} review={review} saveReview={saveReview}/>)}</div></section>
}

function AttributeRow({ attr, item, review, saveReview }: any) {
  const raw = item.extraction.hard_attributes[attr]
  const rawValue = displayRawAttribute(attr, raw)
  const conf = typeof raw?.confidence === 'number' ? raw.confidence : undefined
  const norm = normalizeValue(attr, raw)
  const existing = review.attribute_reviews.find((r: any) => r.attribute === attr)
  const enums = getEnumForAttribute(attr)
  const update = (patch: any) => {
    const next = review.attribute_reviews.filter((r: any) => r.attribute !== attr)
    next.push({ attribute: attr, raw_value: rawValue, canonical_suggestion: norm.canonical, decision: 'unset', override_value: attr === 'details' ? [] : null, reason: '', ...existing, ...patch })
    saveReview({ ...review, attribute_reviews: next })
  }
  return <div className="attr-row"><span>{attr}</span><b>{rawValue}</b><Badge tone={confidenceTier(conf) === 'AUTO' ? 'green' : confidenceTier(conf) === 'REVIEW' ? 'amber' : 'red'}>{conf ?? '—'}</Badge><em className={norm.valid ? 'ok' : 'warn'}>{displayCanonical(norm.canonical) ?? norm.warning}</em><select value={existing?.decision ?? 'unset'} onChange={(e) => update({ decision: e.target.value })}><option value="unset">unset</option><option value="accept">accept raw</option><option value="accept_normalized">accept normalized</option><option value="override">override</option><option value="needs_review">needs review</option></select>{existing?.decision === 'override' && enums && (attr === 'details' ? <select multiple value={existing.override_value ?? []} onChange={(e) => update({ override_value: Array.from(e.currentTarget.selectedOptions).map((o) => o.value) })}>{enums.map((v) => <option key={v}>{v}</option>)}</select> : <select value={existing.override_value ?? ''} onChange={(e) => update({ override_value: e.target.value })}><option value="">Choose canonical</option>{enums.map((v) => <option key={v}>{v}</option>)}</select>)}<input placeholder="note" value={existing?.reason ?? ''} onChange={(e) => update({ reason: e.target.value })}/></div>
}

function Reasoning({ item, review, saveReview }: any) { const trace = item.extraction.reasoning_trace ?? {}; return <section className="card reasoning-card"><div className="sparkle-badge">✦</div><div className="section-kicker">Stylist reasoning</div><h3>Reasoning trace + prompt feedback</h3>{Object.entries(trace).map(([k,v]) => <details key={k}><summary>{k}</summary><p>{Array.isArray(v) ? v.join('; ') : String(v)}</p></details>)}<details open><summary>v8.2 structural prompt guard</summary><p><code>brand_category</code> defines the target garment scope; reviewed images define visual evidence. If the target category or named component is not visible, flag <code>metadata_image_conflict</code> / manual review instead of extracting the visually dominant non-target garment.</p></details><div className="prompt-feedback"><label><input type="checkbox" checked={review.prompt_feedback.needs_prompt_update} onChange={(e) => saveReview({ ...review, prompt_feedback: { ...review.prompt_feedback, needs_prompt_update: e.target.checked } })}/> Prompt/scoring issue?</label><select value={review.prompt_feedback.issue_type} onChange={(e) => saveReview({ ...review, prompt_feedback: { ...review.prompt_feedback, issue_type: e.target.value } })}>{feedbackTypes.map((t) => <option key={t}>{t}</option>)}</select><textarea className="stylist-note" placeholder="What should v8.2 learn from this? If metadata conflicts with image evidence, note metadata_image_conflict and the visible proof." value={review.prompt_feedback.note} onChange={(e) => saveReview({ ...review, prompt_feedback: { ...review.prompt_feedback, note: e.target.value } })}/></div></section> }

function Badge({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'amber' | 'red' }) { return <span className={`badge ${tone}`}>{children}</span> }
