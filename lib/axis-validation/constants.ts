export const AXES = [
  { id: 'minimalism', code: 'MIN', label: 'Minimalism' },
  { id: 'polish', code: 'POL', label: 'Polish' },
  { id: 'body_awareness', code: 'BOD', label: 'Body Awareness' },
  { id: 'drama', code: 'DRA', label: 'Drama' },
  { id: 'novelty', code: 'NOV', label: 'Novelty' },
  { id: 'craft', code: 'CRA', label: 'Craft' },
  { id: 'boldness', code: 'BLD', label: 'Boldness' },
  { id: 'glamour', code: 'GLM', label: 'Glamour' },
  { id: 'trend_currency', code: 'TRD', label: 'Trend Currency' },
  { id: 'styling_affordance', code: 'STY', label: 'Styling Affordance' },
  { id: 'cultural_richness', code: 'CUL', label: 'Cultural Richness' },
] as const

export type AxisId = (typeof AXES)[number]['id']

export const VIBES = [
  { id: 'old_money', label: 'Old Money', aliases: ['quiet luxury', 'stealth wealth'] },
  { id: 'glam', label: 'Glam', aliases: ['glamorous', 'red carpet'] },
  { id: 'cool_girl', label: 'Cool Girl', aliases: ['effortless', 'off duty'] },
  { id: 'sexy_elegant', label: 'Sexy Elegant', aliases: ['sexy', 'date night'] },
  { id: 'wedding_guest', label: 'Wedding Guest', aliases: ['occasion', 'formal event'] },
  { id: 'dubai_glam', label: 'Dubai Glam', aliases: ['modest glam', 'gulf style'] },
  { id: 'elevated_city', label: 'Elevated City', aliases: ['office chic', 'city break'] },
  { id: 'winter_holidays', label: 'Winter Holidays', aliases: ['festive', 'holiday party'] },
  { id: 'beach_resort', label: 'Beach & Resort', aliases: ['beach resort', 'vacation', 'resort wear'] },
  { id: 'it_girl', label: 'IT Girl', aliases: ['trending', 'viral'] },
  { id: 'elevated_basics', label: 'Elevated Basics / Hailey Bieber', aliases: ['elevated basics', 'hailey bieber style', 'capsule wardrobe', 'basics'] },
  { id: 'unique_finds', label: 'Unique Finds', aliases: ['artisan', 'handmade', 'one of a kind', 'emerging designer'] },
] as const

export type VibeId = (typeof VIBES)[number]['id']

const vibeLookup = new Map<string, { id: VibeId; label: string }>()
for (const vibe of VIBES) {
  vibeLookup.set(vibe.label.toLowerCase(), { id: vibe.id, label: vibe.label })
  vibeLookup.set(vibe.id, { id: vibe.id, label: vibe.label })
  for (const alias of vibe.aliases) vibeLookup.set(alias.toLowerCase(), { id: vibe.id, label: vibe.label })
}

export function canonicalizeVibe(input: string) {
  return vibeLookup.get(input.trim().toLowerCase()) ?? null
}

export const BRAND_SLUGS: Record<string, string> = {
  'Try On Dress': 'try-on-dress',
  'Studio Picante': 'studio-picante',
  'Self Centred': 'self-centred',
  Dilnaz: 'dilnaz',
  'Aseem Kapoor': 'aseem-kapoor',
  'Afro Nikitha (Nikita Mhaisalkar)': 'afro-nikitha',
  'Bobo Calcutta': 'bobo-calcutta',
  'Shahin Mannan': 'shahin-mannan',
  'Surily G': 'surily-g',
  'LEH Studios': 'leh-studios',
  ITRH: 'itrh',
}

export const ENUMS = {
  primary_color: ['black','white','cream','ivory','beige','brown','tan','camel','chocolate','navy','blue','cobalt','royal-blue','green','olive','sage','emerald','forest-green','red','burgundy','maroon','wine','pink','blush','dusty-rose','fuchsia','hot-pink','coral','terracotta','orange','yellow','mustard','gold','silver','grey','charcoal','stone','taupe','purple','lavender','lilac','teal','turquoise','mint','nude','champagne','multicolor'],
  secondary_color: ['none','black','white','cream','ivory','beige','brown','tan','camel','chocolate','navy','blue','cobalt','royal-blue','green','olive','sage','emerald','forest-green','red','burgundy','maroon','wine','pink','blush','dusty-rose','fuchsia','hot-pink','coral','terracotta','orange','yellow','mustard','gold','silver','grey','charcoal','stone','taupe','purple','lavender','lilac','teal','turquoise','mint','nude','champagne','multicolor'],
  material: ['silk','cotton','linen','wool','cashmere','polyester','viscose','rayon','leather','faux-leather','denim','velvet','chiffon','organza','tulle','tweed','knit','jersey','crepe','satin','taffeta','lace','mesh','sequin','brocade','jacquard','crochet','shearling','faux-fur','raffia','suede','none'],
  silhouette: ['fitted','relaxed','a-line','straight','flared','oversized','structured','boxy','slim','tailored','bodycon','flowy','empire','wrap','shift','column','mermaid','balloon','cocoon','draped'],
  length: ['crop','mini','short','knee','midi','maxi','full-length','ankle','floor-length','asymmetric'],
  neckline: ['round','crew','v-neck','deep-v','plunging','square','off-shoulder','one-shoulder','halter','high-neck','mock-neck','turtleneck','collared','lapel','sweetheart','strapless','bardot','cowl','boat-neck','keyhole','scoop'],
  sleeve_length: ['sleeveless','short','long','three-quarter','cap','strapless','one-shoulder','off-shoulder','bell','cape'],
  pattern: ['solid','floral','stripe','striped','geometric','abstract','ethnic-print','embroidered','printed','textured','plaid','check','polka-dot','animal-print','leopard','zebra','paisley','tie-dye','ombre','color-block','houndstooth','tropical','graphic','sequined','embellished','cutout','cable','quilted','tweed'],
  details: ['sequin','crystal','beading','embroidered','3D-embroidery','appliqué','feather','fringe','mirror-work','ruched','pleated','draped','layered','tiered','corseted','boned','gathered','smocked','quilted','sheer','lace','mesh','crochet','velvet','leather-faux-leather','fur-faux-fur','cutout','backless','high-slit','cape','peplum','ruffled','bow','train','tassel'],
  price_tier: ['entry','mid-range','contemporary','premium','luxury','collector','unknown'],
}
