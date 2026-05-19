import type { AxisId } from './constants'

export const AXIS_RUBRIC_VERSION = 'v1.0'

export type AxisRubric = {
  id: AxisId
  question: string
  measures: string
  increases: string[]
  decreases: string[]
  bands: { range: string; label: string; example: string }[]
  caps?: string[]
  notes?: string[]
}

export const AXIS_RUBRICS: Record<AxisId, AxisRubric> = {
  minimalism: {
    id: 'minimalism',
    question: 'How many visual elements compete for attention?',
    measures: 'Visual complexity of the garment.',
    increases: ['solid/tonal colour', 'clean uninterrupted silhouette', 'no embellishment', 'single fabric or texture', 'minimal seaming/details', 'no visible closures/hardware'],
    decreases: ['multiple colours or prints', 'sequins/beading/crystals/embroidery', 'mixed textures or fabrics', 'layering', 'visible hardware', 'ruffles/frills/tiers/pleats', 'patchwork/appliqué'],
    bands: [
      { range: '1–2', label: 'Maximalist / visually noisy', example: 'Heavily embroidered lehenga with mirror work, multiple colours, tassels' },
      { range: '3–4', label: 'Busy but intentional', example: 'Printed dress with ruching, belt and contrast stitching' },
      { range: '5–6', label: 'Moderate: one or two design elements', example: 'Solid dress with subtle pleating; striped clean-cut top' },
      { range: '7–8', label: 'Clean: simple silhouette, one fabric, almost nothing extra', example: 'Cream silk slip dress; black tailored trouser' },
      { range: '9–10', label: 'Ultra-minimal / pure form', example: 'Plain white tee; plain black column dress; unadorned knit' },
    ],
    caps: ['Any sequin/beading/crystal → max 5', 'Bold print → max 6', 'Multiple visible textures → max 7'],
    notes: ['Nude colour alone is not minimalism. Score the full visual simplicity: colour, silhouette, surface, decoration, contrast, construction.'],
  },
  polish: {
    id: 'polish',
    question: 'How considered does every detail look?',
    measures: 'Construction quality, fit precision, and visible finish level.',
    increases: ['sharp seams', 'precise tailoring', 'premium fabric/drape', 'clean hems', 'lined-looking construction', 'professional closures/details', 'good proportion/fit'],
    decreases: ['pulling/bunching/poor fit', 'raw or unfinished edges', 'cheap-looking fabric', 'sloppy oversized fit', 'distressing', 'very casual construction'],
    bands: [
      { range: '1–2', label: 'Raw / DIY / unfinished', example: 'Distressed denim with raw hems and loose threads' },
      { range: '3–4', label: 'Casual, acceptable but unremarkable', example: 'Basic cotton tee; standard jersey dress' },
      { range: '5–6', label: 'Well-made and clean', example: 'Nice cotton blouse; well-made wrap dress' },
      { range: '7–8', label: 'Clearly high quality', example: 'Tailored blazer; silk bias-cut dress; crepe midi' },
      { range: '9–10', label: 'Couture-level / immaculate', example: 'Perfect wool coat; haute couture draping' },
    ],
    caps: ['Visible poor fit → max 4', 'Cheap-looking fabric → max 5', 'Deliberately distressed/raw → max 5'],
  },
  body_awareness: {
    id: 'body_awareness',
    question: 'How much body shape or skin is visible/emphasized?',
    measures: 'How much the garment reveals, follows, or celebrates the body.',
    increases: ['bodycon/fitted silhouette', 'cutouts', 'deep/plunging/strapless neckline', 'high slit', 'sheer/mesh panels', 'mini length', 'backless', 'spaghetti straps/halter', 'form-fitting knit'],
    decreases: ['oversized silhouette', 'high neck/long sleeve/full coverage', 'layered or voluminous construction', 'maxi with no slit', 'boxy/straight cut', 'loose draping', 'modest coverage'],
    bands: [
      { range: '1–2', label: 'Fully concealing', example: 'Oversized kaftan; voluminous abaya; cocoon coat' },
      { range: '3–4', label: 'Covered but body is hinted', example: 'A-line midi with sleeves; tailored trouser suit' },
      { range: '5–6', label: 'Balanced fit/skin', example: 'Fitted midi with sleeves; wrap dress' },
      { range: '7–8', label: 'Body-celebrating', example: 'Fitted slip dress; one-shoulder midi; corseted waist' },
      { range: '9–10', label: 'Maximum body awareness', example: 'Mesh bodysuit; mini cutout dress; sheer gown' },
    ],
    caps: ['Full sleeve + high neck + midi/maxi + no slit → max 4', 'Oversized silhouette → max 3'],
  },
  drama: {
    id: 'drama',
    question: 'Would this turn heads in a room?',
    measures: 'Visual wow factor and room impact.',
    increases: ['exaggerated proportions', 'bold volume', 'heavy embellishment/feathers/crystals', 'strong colour contrast', 'architectural construction', 'train/movement', 'dramatic neckline/shoulders'],
    decreases: ['standard proportions', 'quiet colour', 'simple silhouette', 'no embellishment', 'weekday/office wearable without comment'],
    bands: [
      { range: '1–2', label: 'Invisible / easy to walk past', example: 'Plain tee; basic trouser; simple knit' },
      { range: '3–4', label: 'Pleasant but unremarkable', example: 'Well-cut blazer; solid midi dress' },
      { range: '5–6', label: 'Noticeable detail, colour or shape', example: 'Bold colour midi; interesting neckline; statement sleeve' },
      { range: '7–8', label: 'Head-turning', example: 'Feather trim dress; sculptural shoulder blazer; sequin midi' },
      { range: '9–10', label: 'Theatrical / red-carpet energy', example: 'Full beaded gown; dramatic cape; avant-garde construction' },
    ],
    caps: ['Neutral + simple silhouette + no embellishment → max 4', 'Weekday brunch without comment → max 5'],
  },
  novelty: {
    id: 'novelty',
    question: 'Has this been done before?',
    measures: 'Freshness and unexpectedness of design.',
    increases: ['unusual silhouette', 'unexpected fabric for garment type', 'asymmetry/deconstruction', 'unexpected mixed media', 'novel detail placement/proportion', 'never-seen-before impression'],
    decreases: ['classic timeless shapes', 'common reproduced styles', 'trend copies', 'traditional construction with no twist'],
    bands: [
      { range: '1–2', label: 'Timeless classic', example: 'White button-down; navy blazer; little black dress' },
      { range: '3–4', label: 'Familiar with minor twist', example: 'Wrap dress with unusual tie placement' },
      { range: '5–6', label: 'Interesting but recognizable', example: 'Blazer with deconstructed lapel; dress with unexpected cutout' },
      { range: '7–8', label: 'Fresh / not done much', example: 'Asymmetric hem + mixed fabric + novel proportion' },
      { range: '9–10', label: 'Genuinely new', example: 'Deconstructed garment; new category invention' },
    ],
  },
  craft: {
    id: 'craft',
    question: 'Is there visible evidence of hand-making or technique?',
    measures: 'Handwork, artisanal technique, and heritage craftsmanship.',
    increases: ['visible hand embroidery', 'block printing/hand-dye', 'crochet/hand-knit', 'heritage weaving', 'hand beading/sequins', 'hand finishing', 'batik/ikat/zari/gota'],
    decreases: ['standard machine construction', 'mass-production indicators', 'generic fabrics with no craft story', 'factory-standard finishing'],
    bands: [
      { range: '1–2', label: 'Commodity / no visible craft', example: 'Basic polyester blouse; jersey tee' },
      { range: '3–4', label: 'Well-made but not artisanal', example: 'Tailored blazer; quality machine-made silk dress' },
      { range: '5–6', label: 'Some craft visible', example: 'Machine dress with hand-embroidered neckline detail' },
      { range: '7–8', label: 'Clearly artisanal', example: 'Fully embroidered bodice; hand-beaded skirt; crochet dress' },
      { range: '9–10', label: 'Master craft / intensive heritage work', example: 'Full zardozi; hand-woven silk saree; 40+ hours handwork' },
    ],
    notes: ['Craft and cultural richness often correlate but are different axes. Machine-made kurta can be culturally rich but low craft.'],
  },
  boldness: {
    id: 'boldness',
    question: 'Would the average person hesitate before wearing this?',
    measures: 'Wearer risk and courage required.',
    increases: ['saturated colours', 'revealing cuts', 'statement proportions', 'unexpected fabrics', 'neon/metallic/animal print', 'unconventional styling', 'polarizing design'],
    decreases: ['safe colours', 'standard cuts/proportions', 'universally comfortable', 'classic styling', 'nothing hesitation-inducing'],
    bands: [
      { range: '1–2', label: 'Completely safe', example: 'Beige cashmere crew; black midi; navy trouser' },
      { range: '3–4', label: 'Mostly safe with small element', example: 'White dress with small cutout' },
      { range: '5–6', label: 'Takes some confidence', example: 'Bright red dress; one-shoulder; leather pants' },
      { range: '7–8', label: 'Bold / not everyone would wear it', example: 'Deep plunge; neon suit; full sequin' },
      { range: '9–10', label: 'Provocative or rule-breaking', example: 'Completely sheer dress; extreme crop + maxi slit' },
    ],
  },
  glamour: {
    id: 'glamour',
    question: 'Does it sparkle, shimmer, or feel evening/red-carpet?',
    measures: 'Sparkle, shine, embellishment and evening energy.',
    increases: ['sequins/crystals/beading', 'metallic fabric/thread', 'gold/silver accents', 'rhinestones/pearls', 'satin/silk sheen', 'jewel tones', 'evening construction'],
    decreases: ['matte cotton/linen/knit', 'no embellishment', 'casual daytime construction', 'earth tones/neutrals without sheen', 'denim/jersey/casual materials'],
    bands: [
      { range: '1–2', label: 'Zero glamour / daytime casual', example: 'Cotton tee; linen pants; basic knit' },
      { range: '3–4', label: 'Slight elevation, no sparkle', example: 'Satin cami; silk blouse' },
      { range: '5–6', label: 'Some glamour elements', example: 'Sequin trim; metallic thread' },
      { range: '7–8', label: 'Clearly glamorous', example: 'Fully sequined top; crystal embellished dress' },
      { range: '9–10', label: 'Maximum red carpet', example: 'All-over beaded gown; crystal bodysuit; metallic statement piece' },
    ],
    caps: ['Cotton/linen/denim → max 3', 'No embellishment whatsoever → max 4 even if satin'],
  },
  trend_currency: {
    id: 'trend_currency',
    question: 'Would this get fashion engagement today?',
    measures: 'Current social/fashion-week relevance.',
    increases: ['currently trending silhouettes', 'seen on current influencers', 'viral TikTok/Instagram energy', 'current fashion-week colours/shapes', 'actively reposted/recreated styles'],
    decreases: ['timeless/undateable', 'dated past trend', 'classic staple with no trend signal'],
    bands: [
      { range: '1–2', label: 'Timeless / era-neutral', example: 'White button-down; camel coat; little black dress' },
      { range: '3–4', label: 'Classic with slight contemporary feel', example: 'Well-cut blazer in current proportions' },
      { range: '5–6', label: 'Somewhat current', example: 'Trending colour in a classic shape' },
      { range: '7–8', label: 'Clearly current', example: 'Trending silhouette + colour combination' },
      { range: '9–10', label: 'Peak viral now', example: 'The “it” dress of the season; viral brand piece' },
    ],
    notes: ['Needs quarterly recalibration. What is 9 now may be 5 later.'],
  },
  styling_affordance: {
    id: 'styling_affordance',
    question: 'How many outfits and contexts can this anchor?',
    measures: 'Versatility and styling range.',
    increases: ['works day-to-night/casual-to-formal', 'neutral pairing colour', 'simple enough to style up/down', 'year-round use', 'works with many accessories/layers'],
    decreases: ['single-context piece', 'very specific styling required', 'statement piece overwhelms outfits', 'seasonal limitation', 'needs specific companion pieces'],
    bands: [
      { range: '1–2', label: 'One-context only', example: 'Full sequin floor-length gown; costume piece' },
      { range: '3–4', label: 'Limited contexts', example: 'Formal cocktail dress' },
      { range: '5–6', label: 'Moderate versatility', example: 'Printed midi: brunch, dinner, office maybe' },
      { range: '7–8', label: 'Very versatile', example: 'Black blazer; cream silk blouse; good jeans' },
      { range: '9–10', label: 'Goes with almost everything', example: 'White tee; black trouser; classic leather jacket' },
    ],
  },
  cultural_richness: {
    id: 'cultural_richness',
    question: 'Is cultural meaning or heritage visible?',
    measures: 'Cultural meaning, heritage technique, or regional storytelling. Always positive, never a penalty.',
    increases: ['traditional silhouettes with modern interpretation', 'heritage textile techniques', 'regional embroidery', 'cultural colour symbolism', 'specific cultural context/occasion', 'fusion of tradition and contemporary design'],
    decreases: ['generic Western fashion', 'placeless/global commodity feel', 'no identifiable heritage element'],
    bands: [
      { range: '1–2', label: 'Generic / no cultural reference', example: 'Basic blazer; jeans; tee' },
      { range: '3–4', label: 'Slight cultural nod', example: 'Western dress in culturally significant colour' },
      { range: '5–6', label: 'Clear cultural element', example: 'Kurta-style top; Moroccan-inspired embroidery' },
      { range: '7–8', label: 'Strong cultural presence', example: 'Embroidered lehenga-style skirt; block-printed kaftan' },
      { range: '9–10', label: 'Deep heritage as design story', example: 'Hand-woven silk saree; full zardozi bridal piece' },
    ],
    notes: ['Cultural richness is never a demotion for any vibe. A Western dress with Indian artisan embroidery can score on both craft and cultural richness.'],
  },
}
