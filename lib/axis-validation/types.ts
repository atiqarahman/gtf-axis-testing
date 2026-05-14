import type { AxisId, VibeId } from './constants'

export type Product = {
  product_id: string
  title: string
  brand: string
  category: string
  image_file: string
  price: number | null
  currency: string | null
}

export type Extraction = {
  product_id: string
  schema_version: string
  extraction_timestamp?: string
  hard_attributes: Record<string, any>
  axis_scores: Record<AxisId, { score: number; reasoning: string }>
  styling_leverage?: { score: number; reasoning: string }
  suggested_vibes: string[]
  primary_vibe: string
  all_vibe_scores: Record<string, { score: number; raw_score?: number }>
  gpt_suggested_vibes: string[]
  soft_attributes?: Record<string, any>
  confidence?: string
  reasoning_trace?: Record<string, any>
  product_tier: 'AUTO' | 'REVIEW' | 'MANUAL' | string
  tier_summary?: { auto?: number; review?: number; manual?: number }
  review_needed?: string[]
  manual_needed?: string[]
}

export type ImageCandidate = { src: string; label: string; confidence: 'exact' | 'fallback' | 'candidate' | 'url' }
export type ImageResolution = { status: 'ok' | 'url' | 'ambiguous' | 'missing'; src?: string; candidates: ImageCandidate[]; message?: string }

export type VibeReview = {
  vibe_id: VibeId
  label: string
  source: 'computed' | 'gpt'
  original_score?: number
  decision: 'agree' | 'disagree' | 'unset'
  correct_vibe_ids: VibeId[]
  reason: string
}

export type AxisOverride = { axis_id: AxisId; label: string; original_score: number; override_score: number; reason: string; rubric_version?: string }
export type AttributeReview = { attribute: string; raw_value: any; canonical_suggestion: string | string[] | null; decision: 'unset' | 'accept' | 'accept_normalized' | 'override' | 'needs_review'; override_value: any; reason: string }

export type ProductReview = {
  product_id: string
  reviewer: string
  review_status: 'draft' | 'completed' | 'skipped'
  reviewed_at?: string
  image_status: ImageResolution['status']
  selected_image_path?: string
  image_resolution_status?: 'not_needed' | 'pending' | 'approved' | 'unresolved' | 'no_valid_candidate'
  image_resolution_reviewed_at?: string
  image_resolution_reviewer?: string
  image_resolution_note?: string
  overall_decision: 'unset' | 'approve' | 'needs_correction' | 'manual_escalation' | 'skip_for_now'
  issue_tags: string[]
  vibe_reviews: VibeReview[]
  axis_overrides: AxisOverride[]
  attribute_reviews: AttributeReview[]
  prompt_feedback: { needs_prompt_update: boolean; issue_type: string; note: string }
}
