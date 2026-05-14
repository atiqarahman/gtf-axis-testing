'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, AlertTriangle, Check, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { AXES, VIBES, canonicalizeVibe, type AxisId, type VibeId } from '@/lib/axis-validation/constants'
import { AXIS_RUBRICS, AXIS_RUBRIC_VERSION } from '@/lib/axis-validation/rubric'
import { loadValidationData, type QaSummary, type ValidationItem } from '@/lib/axis-validation/loadData'
import { resolveImage } from '@/lib/axis-validation/imageResolver'
import { confidenceTier, getEnumForAttribute, normalizeValue } from '@/lib/axis-validation/normalization'
import type { ProductReview, VibeReview } from '@/lib/axis-validation/types'
import './validation.css'

const issueOptions = ['wrong_image','image_mapping_failed','metadata_image_conflict','wrong_category','wrong_vibe','wrong_axis_score','wrong_hard_attribute','glamour_underweighted','glamour_overweighted','cultural_richness_underweighted','body_awareness_wrong','material_uncertain','image_ambiguous','confidence_too_high','auto_false_positive','prompt_issue','taxonomy_issue','manual_review_needed']
const feedbackTypes = ['none','axis_underweight','axis_overweight','wrong_vibe_mapping','bad_attribute_extraction','image_ambiguity','metadata_image_conflict','taxonomy_issue']
const EXCLUDED_BRANDS = ['Shahin Mannan', 'Surily G']
const EXCLUSION_LABEL = '74 lookbook products excluded pending CSV/image-source repair + re-extraction'

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
    axis_overrides: [],
    attribute_reviews: [],
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
  const [queue, setQueue] = useState('all')
  const [query, setQuery] = useState('')
  const [showQa, setShowQa] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [reviewerName, setReviewerName] = useState('RK')

  useEffect(() => {
    loadValidationData().then(({ items, qa }) => {
      setItems(items)
      setQa(qa)
      const saved = localStorage.getItem('gtf-axis-reviews')
      const savedReviewer = localStorage.getItem('gtf-axis-reviewer')
      if (savedReviewer) setReviewerName(savedReviewer)
      if (saved) setReviews(JSON.parse(saved))
    })
  }, [])

  useEffect(() => {
    if (Object.keys(reviews).length) localStorage.setItem('gtf-axis-reviews', JSON.stringify(reviews))
  }, [reviews])

  useEffect(() => {
    localStorage.setItem('gtf-axis-reviewer', reviewerName)
  }, [reviewerName])

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
  const unresolvedImageIssueIds = useMemo(() => new Set((qa?.imageIssues ?? []).filter((i) => {
    if (EXCLUDED_BRANDS.includes(i.brand)) return false
    const r = reviews[i.product_id]
    return !(r?.image_resolution_status === 'approved' && r.selected_image_path) && r?.image_resolution_status !== 'no_valid_candidate'
  }).map((i) => i.product_id)), [qa, reviews])
  const approvedImageIds = useMemo(() => new Set(Object.values(reviews).filter((r) => r.image_resolution_status === 'approved').map((r) => r.product_id)), [reviews])
  const failedImageIds = useMemo(() => new Set(Object.values(reviews).filter((r) => r.image_resolution_status === 'no_valid_candidate').map((r) => r.product_id)), [reviews])
  const filtered = useMemo(() => activeItems.filter((item) => {
    if (queue === 'image_unresolved' && !unresolvedImageIssueIds.has(item.product.product_id)) return false
    if (queue === 'image_approved' && !approvedImageIds.has(item.product.product_id)) return false
    if (queue === 'image_failed' && !failedImageIds.has(item.product.product_id)) return false
    if (brand !== 'all' && item.product.brand !== brand) return false
    if (tier !== 'all' && item.extraction.product_tier !== tier) return false
    const q = query.toLowerCase().trim()
    if (q && !`${item.product.product_id} ${item.product.title} ${item.product.brand}`.toLowerCase().includes(q)) return false
    return true
  }), [activeItems, approvedImageIds, brand, failedImageIds, queue, tier, query, unresolvedImageIssueIds])

  const item = filtered[Math.min(index, Math.max(0, filtered.length - 1))]
  const review = item ? reviews[item.product.product_id] ?? blankReview(item) : null
  const reviewedCount = Object.values(reviews).filter((r) => r.review_status === 'completed').length
  const skippedCount = Object.values(reviews).filter((r) => r.review_status === 'skipped').length
  const touchedCount = Object.keys(reviews).length
  const filteredReviewedCount = filtered.filter((i) => reviews[i.product.product_id]?.review_status === 'completed').length
  const progressPct = activeItems.length ? Math.round(((reviewedCount + skippedCount) / activeItems.length) * 100) : 0
  const correctionCount = Object.values(reviews).filter((r) => r.overall_decision === 'needs_correction' || r.axis_overrides.length || r.attribute_reviews.length || r.vibe_reviews.some((v) => v.decision === 'disagree')).length
  const vibeDisagreementCount = Object.values(reviews).reduce((sum, r) => sum + r.vibe_reviews.filter((v) => v.decision === 'disagree').length, 0)
  const axisOverrideCount = Object.values(reviews).reduce((sum, r) => sum + r.axis_overrides.length, 0)
  const unresolvedImageIssues = qa?.imageIssues.filter((i) => unresolvedImageIssueIds.has(i.product_id)) ?? []
  const imageIssueCount = unresolvedImageIssues.length
  const autoFalse = Object.values(reviews).filter((r) => items.find((i) => i.product.product_id === r.product_id)?.extraction.product_tier === 'AUTO' && r.overall_decision !== 'approve' && r.overall_decision !== 'unset').length

  function saveReview(next: ProductReview) {
    setReviews((prev) => ({ ...prev, [next.product_id]: { ...next, reviewer: reviewerName || 'anonymous' } }))
  }
  function setDecision(decision: ProductReview['overall_decision']) {
    if (!item || !review) return
    saveReview({ ...review, overall_decision: decision, review_status: decision === 'skip_for_now' ? 'skipped' : 'completed', reviewed_at: new Date().toISOString() })
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
      prompt_guard_version: 'v8.2-image-over-metadata-guard',
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
  function exportCsv() {
    const rows = Object.values(reviews).map((r) => {
      const source = items.find((i) => i.product.product_id === r.product_id)
      return {
        product_id: r.product_id,
        brand: source?.product.brand ?? '',
        title: source?.product.title ?? '',
        product_category: source?.product.category ?? '',
        extraction_category: source?.extraction.hard_attributes.category?.value ?? '',
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
        prompt_needs_update: r.prompt_feedback.needs_prompt_update,
        prompt_issue_type: r.prompt_feedback.issue_type,
        prompt_note: r.prompt_feedback.note,
        prompt_guard_version: 'v8.2-image-over-metadata-guard',
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
  const radar = AXES.map((axis) => {
    const override = review.axis_overrides.find((o) => o.axis_id === axis.id)
    return { axis: axis.label.replace(' ', '\n'), original: item.extraction.axis_scores[axis.id]?.score ?? 0, override: override?.override_score ?? item.extraction.axis_scores[axis.id]?.score ?? 0 }
  })

  return (
    <main className="workbench">
      <header className="topbar">
        <div>
          <div className="brand-lockup"><span className="gtf-logo">GTF</span><span className="lab-pill">Taste Lab</span></div>
          <p className="eyebrow">Task 3 · Axis Validation Studio</p>
          <h1>Calibrate GTF’s Taste Engine</h1>
          <p className="subtitle">Review GPT’s fashion judgment against expert taste — product image, vibe logic, axis scores, and correction notes in one studio.</p>
        </div>
        <div className="metrics expanded">
          <Metric label="Active products" value={activeItems.length} />
          <Metric label="Reviewed" value={reviewedCount} />
          <Metric label="Corrections" value={correctionCount} />
          <Metric label="Vibe disagreements" value={vibeDisagreementCount} />
          <Metric label="Axis overrides" value={axisOverrideCount} />
          <Metric label="Image issues" value={imageIssueCount} />
          <Metric label="AUTO false confidence" value={autoFalse} />
        </div>
      </header>

      <section className="toolbar taste-toolbar">
        <input placeholder="Search products, brands, SKUs…" value={query} onChange={(e) => { setQuery(e.target.value); setIndex(0) }} />
        <select value={brand} onChange={(e) => { setBrand(e.target.value); setIndex(0) }}><option value="all">All brands</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>
        <select value={tier} onChange={(e) => { setTier(e.target.value); setIndex(0) }}><option value="all">All tiers</option><option>AUTO</option><option>REVIEW</option><option>MANUAL</option></select>
        <select value={queue} onChange={(e) => { setQueue(e.target.value); setIndex(0) }}><option value="all">All active products</option><option value="image_unresolved">Unresolved ambiguous photos ({unresolvedImageIssues.length})</option><option value="image_approved">Approved images ({approvedImageIds.size})</option><option value="image_failed">Manual image fix ({failedImageIds.size})</option></select>
        <button className="ghost soft-action" onClick={() => setShowQa(!showQa)}><SlidersHorizontal size={16}/> Data QA</button>
        <button className="ghost soft-action" onClick={() => setShowShortcuts(!showShortcuts)}>⌘ Shortcuts</button>
        <label className="reviewer-field"><span>Reviewer</span><input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} /></label>
        <button className="ghost soft-action" onClick={exportCsv}><Download size={16}/> CSV</button>
        <button className="primary gradient-action" onClick={exportJson}><Download size={16}/> Export JSON</button>
      </section>

      <section className="session-strip">
        <div className="session-copy"><b>Review session</b><span>{reviewerName || 'anonymous'} · {filteredReviewedCount}/{filtered.length} reviewed in current queue · {reviewedCount} approved/corrected, {skippedCount} skipped, {touchedCount} touched overall · {excludedCount} lookbook products excluded pending source repair</span></div>
        <div className="progress-wrap"><div className="progress-label"><span>Batch progress</span><b>{progressPct}%</b></div><div className="progress-track"><div style={{ width: `${progressPct}%` }} /></div></div>
        <Badge tone={review.review_status === 'completed' ? 'green' : review.review_status === 'skipped' ? 'amber' : 'red'}>{review.review_status.toUpperCase()}</Badge>
      </section>

      {queue === 'image_unresolved' && <section className="queue-banner"><b>Image QA queue</b><span>Only unresolved ambiguous/missing images are shown. Approving selected image removes the product from this queue. If none match, send it to Manual image fix.</span></section>}

      {queue === 'image_failed' && <section className="queue-banner danger-banner"><b>Manual image fix queue</b><span>These products have no valid local image candidate. Do not validate attributes, axes, or vibes until source image mapping is repaired.</span></section>}

      {showQa && qa && <section className="qa"><b>Data QA:</b> {qa.totalProducts} source products / {activeItems.length} active products · {EXCLUSION_LABEL} · missing axes {qa.missingAxes} · invalid axis scores {qa.invalidAxisScores} · missing vibe scores {qa.missingVibeScores} · invalid vibe labels {qa.invalidVibes} · enum warnings {qa.invalidEnums.length} · unresolved image issues {unresolvedImageIssues.length} / original {qa.imageIssues.length} · images ok/url/ambiguous/missing {qa.imageStatusCounts.ok}/{qa.imageStatusCounts.url}/{qa.imageStatusCounts.ambiguous}/{qa.imageStatusCounts.missing}
        <details><summary>Image issues ({unresolvedImageIssues.length} unresolved)</summary><div className="qa-list clickable">{unresolvedImageIssues.slice(0,120).map((i) => <button type="button" key={i.product_id} onClick={() => jumpToProduct(i.product_id)}><b>{i.product_id}</b> · {i.brand} · {i.status} · {i.image_file}<br/><span>{i.message} · candidates: {i.candidates.slice(0,4).join(', ') || 'none'} · click to review</span></button>)}</div>{!unresolvedImageIssues.length && <p className="qa-resolved">All visible image issues are resolved in this browser session.</p>}</details>
        <details><summary>Enum warnings ({qa.invalidEnums.length})</summary><div className="qa-list">{qa.invalidEnums.slice(0,120).map((i, idx) => <div key={`${i.product_id}-${i.attribute}-${idx}`}><b>{i.product_id}</b> · {i.attribute}: {String(i.value)} · <span>{i.warning}</span></div>)}</div></details>
      </section>}

      {showShortcuts && <section className="qa shortcuts"><b>Keyboard shortcuts:</b> ← Previous · → Next · A Approve · D Needs correction · S Skip · E Export JSON. Inputs, selects, and textareas ignore shortcuts while focused.</section>}

      <section className="review-grid">
        <ProductImage item={item} image={image} review={review} saveReview={saveReview} reviewerName={reviewerName} queue={queue} onAdvance={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))} position={`${Math.min(index + 1, filtered.length)} / ${filtered.length}`} />
        <div className="review-panel">
          <Meta item={item} image={image} />
          <Decision review={review} saveReview={saveReview} setDecision={setDecision} />
          <VibePanel item={item} review={review} saveReview={saveReview} />
          <AxisPanel item={item} review={review} saveReview={saveReview} radar={radar} />
          <AttributePanel item={item} review={review} saveReview={saveReview} />
          <Reasoning item={item} review={review} saveReview={saveReview} />
        </div>
      </section>

      <footer className={queue === 'image_unresolved' ? "navrow image-mode" : "navrow"}>
        <button className="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))}><ChevronLeft size={16}/> Previous</button>
        {queue === 'image_unresolved' ? <span className="mode-copy">Image QA mode: approve image mapping in the image panel, or mark no valid candidate. Product approval is intentionally hidden.</span> : <>
          <button className="danger" onClick={() => setDecision('manual_escalation')}>Manual escalation</button>
          <button className="ghost" onClick={() => setDecision('skip_for_now')}>Skip</button>
          <button className="primary" onClick={() => setDecision('approve')}><Check size={16}/> Approve product</button>
        </>}
        <button className="ghost" onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}>Next <ChevronRight size={16}/></button>
      </footer>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

function ProductImage({ item, image, review, saveReview, position, reviewerName, queue, onAdvance }: any) {
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
    {image.status === 'ambiguous' && <div className="candidate-box image-chooser"><div className="candidate-copy"><b>Ambiguous image — choose and approve exact product photo</b><p>{selectedCandidate ? `Selected: ${selectedCandidate.label}` : image.message}</p></div><div className="candidates">{image.candidates.slice(0,8).map((c: any) => <button key={c.src} className={src === c.src ? 'selected-candidate' : ''} onClick={() => selectImage(c)}><img src={c.src} alt={c.label}/><span>{c.label}</span><em>{src === c.src ? 'Selected' : c.confidence}</em></button>)}</div><div className="image-approval"><div className="image-actions"><button className={isImageApproved ? 'selected' : 'primary'} disabled={!selectedCandidate || isImageApproved || hasNoValidCandidate} onClick={approveSelectedImage}>{isImageApproved ? 'Selected image approved' : 'Approve selected image'}</button><button className="danger" disabled={hasNoValidCandidate} onClick={markNoValidCandidate}>None of these match product</button></div>{hasNoValidCandidate ? <span>Sent to Manual image fix · do not validate downstream fields yet.</span> : isImageApproved ? <span>Approved by {review.image_resolution_reviewer} · saved in export · auto-advances in Image QA queue</span> : <span>Selection is not resolved until approved.</span>}</div></div>}
    <div className="product-caption"><p className="caption-kicker">Now reviewing</p><h2>{item.product.title}</h2><p>{item.product.brand}</p><code>{item.product.product_id}</code></div>
  </aside>
}

function Meta({ item, image }: { item: ValidationItem; image: any }) {
  const primary = image.src
  const secondary = image.candidates?.[1]?.src
  return <section className="card"><div className="card-title"><h3>Product metadata</h3><Badge tone={item.extraction.product_tier === 'AUTO' ? 'green' : item.extraction.product_tier === 'REVIEW' ? 'amber' : 'red'}>{item.extraction.product_tier}</Badge></div>
    <div className="meta-grid"><span>Category</span><b>{item.product.category}</b><span>Extracted category</span><b>{item.extraction.hard_attributes.category?.value}</b><span>Confidence</span><b>{item.extraction.confidence ?? '—'}</b><span>Review needed</span><b>{item.extraction.review_needed?.join(', ') || 'None'}</b><span>Manual needed</span><b>{item.extraction.manual_needed?.join(', ') || 'None'}</b><span>Catalog image ref</span><code>{item.product.image_file || '—'}</code><span>Primary image used</span>{primary ? <a href={primary} target="_blank">open primary</a> : <b>—</b>}<span>Secondary candidate</span>{secondary ? <a href={secondary} target="_blank">open secondary</a> : <b>—</b>}</div>
  </section>
}

function Decision({ review, saveReview, setDecision }: any) {
  return <section className="card"><h3>Overall decision</h3><div className="button-grid">{['approve','needs_correction','manual_escalation','skip_for_now'].map((d) => <button key={d} className={review.overall_decision === d ? 'selected' : 'ghost'} onClick={() => setDecision(d)}>{d.replaceAll('_',' ')}</button>)}</div><div className="chips">{issueOptions.map((tag) => <button key={tag} className={review.issue_tags.includes(tag) ? 'chip active' : 'chip'} onClick={() => saveReview({ ...review, issue_tags: review.issue_tags.includes(tag) ? review.issue_tags.filter((t: string) => t !== tag) : [...review.issue_tags, tag] })}>{tag.replaceAll('_',' ')}</button>)}</div></section>
}

function VibePanel({ item, review, saveReview }: { item: ValidationItem; review: ProductReview; saveReview: (r: ProductReview) => void }) {
  const computed = Object.entries(item.extraction.all_vibe_scores).sort((a,b) => b[1].score - a[1].score).slice(0, 12).map(([label, obj]) => ({ label, score: obj.score, source: 'computed' as const }))
  const gpt = (item.extraction.gpt_suggested_vibes ?? []).map((label) => ({ label, score: undefined, source: 'gpt' as const }))
  return <section className="card vibe-card"><div className="section-kicker">AI style alignment</div><h3>Suggested vibe validation</h3><p className="hint">Computed vector vibes and GPT suggestions are separate. Agree when the taste feels right; disagree with a canonical correction and stylist note.</p><div className="vibe-list">{[...computed.slice(0,3), ...gpt].map((v, idx) => <VibeRow key={`${v.source}-${v.label}-${idx}`} vibe={v} review={review} saveReview={saveReview} />)}</div><details><summary>Show all 12 computed vibe scores</summary>{computed.map((v) => <div key={v.label} className="score-row"><span>{v.label}</span><progress max={100} value={v.score}/><b>{v.score.toFixed(1)}</b></div>)}</details></section>
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

  return <section className="card"><div className="section-kicker">Structured product truth</div><div className="card-title"><h3>Hard attribute review</h3><button className="ghost soft-action" onClick={acceptAllNormalized}>Accept all normalized attributes</button></div><p className="hint">This creates explicit audit rows. Untouched/unset fields still do not count as approval.</p><div className="attr-table">{attrs.map((a) => <AttributeRow key={a} attr={a} item={item} review={review} saveReview={saveReview}/>)}</div></section>
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

function Reasoning({ item, review, saveReview }: any) { const trace = item.extraction.reasoning_trace ?? {}; return <section className="card reasoning-card"><div className="sparkle-badge">✦</div><div className="section-kicker">Stylist reasoning</div><h3>Reasoning trace + prompt feedback</h3>{Object.entries(trace).map(([k,v]) => <details key={k}><summary>{k}</summary><p>{Array.isArray(v) ? v.join('; ') : String(v)}</p></details>)}<details open><summary>v8.2 structural prompt guard</summary><p>Treat product title, category, and filename as weak metadata hints only. The product image is the source of truth. If metadata contradicts visible evidence, trust the image and flag <code>metadata_image_conflict</code> instead of forcing category/vibe to match the title.</p></details><div className="prompt-feedback"><label><input type="checkbox" checked={review.prompt_feedback.needs_prompt_update} onChange={(e) => saveReview({ ...review, prompt_feedback: { ...review.prompt_feedback, needs_prompt_update: e.target.checked } })}/> Prompt/scoring issue?</label><select value={review.prompt_feedback.issue_type} onChange={(e) => saveReview({ ...review, prompt_feedback: { ...review.prompt_feedback, issue_type: e.target.value } })}>{feedbackTypes.map((t) => <option key={t}>{t}</option>)}</select><textarea className="stylist-note" placeholder="What should v8.2 learn from this? If metadata conflicts with image evidence, note metadata_image_conflict and the visible proof." value={review.prompt_feedback.note} onChange={(e) => saveReview({ ...review, prompt_feedback: { ...review.prompt_feedback, note: e.target.value } })}/></div></section> }

function Badge({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'amber' | 'red' }) { return <span className={`badge ${tone}`}>{children}</span> }
