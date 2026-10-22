// Which food sprite illustrates an item or a dish ("90 g pollo" → pollo, "Sándwich de pollo" → sandwich).
// Rules run in order (specific before generic); no match falls back to the item's food-type icon.
import { norm } from '../../shared/domain/text';

const RULES: [RegExp, string][] = [
  [/\b(sandwich|sandwiches|torta|tortas|baguette|sub)\b/, 'sandwich'],
  [/\b(taco|tacos|quesadilla|quesadillas|enchilada|enchiladas|flauta|flautas|burrito|burritos|chilaquiles)\b/, 'taco'],
  [/crema de cacahuate|mantequilla de mani|peanut/, 'cacahuate'],
  [/leche condensada|cajeta|miel|mermelada|jarabe|maple/, 'miel'],
  [/paleta helada|helado|nieve/, 'helado'],
  [/pan dulce|concha|dona|cuerno|cuernito|bigote|bisquet|croissant|panque|pastel/, 'pandulce'],
  [/\b(agua|jamaica|horchata)\b/, 'agua'],
  [/\b(cafe|te|latte sin leche|americano|espresso)\b/, 'cafe'],
  [/\b(refresco|coca|soda)\b/, 'refresco'],
  [/\bjugo\b/, 'jugo'],
  [/\b(latte|leche|capuchino|cappuccino)\b/, 'leche'],
  [/\byogu/, 'yogurt'],
  [/\bqueso crema\b|\bcrema\b/, 'crema'],
  [/\bqueso|panela|requeson|cottage|ricota|mozzarella/, 'queso'],
  [/mantequilla|margarina/, 'mantequilla'],
  [/mayonesa|aderezo/, 'mayonesa'],
  [/aceite/, 'aceite'],
  [/aguacate|guacamole/, 'aguacate'],
  [/aceituna/, 'aceituna'],
  [/almendra/, 'almendra'],
  [/cacahuate|mani\b/, 'cacahuate'],
  [/nuez|nueces|pistache|avellana|semilla|chia|ajonjoli|pepita|linaza|pinon|coco/, 'nuez'],
  [/\b(huevo|huevos|clara|claras|omelette)\b/, 'huevo'],
  [/jamon|pavo|salchicha|chorizo/, 'jamon'],
  [/atun en lata|atun drenado|sardina/, 'atun'],
  [/pescado|salmon|tilapia|mojarra|filete|atun|bacalao/, 'pescado'],
  [/camaron|marisco|pulpo|calamar/, 'camaron'],
  [/pollo|pechuga|muslo/, 'pollo'],
  [/carne|res\b|bistec|cecina|cerdo|puerco|chuleta|arrachera|molida|pastor|barbacoa|carnitas/, 'carne'],
  [/arroz|quinoa|cuscus|couscous/, 'arroz'],
  [/avena|granola|amaranto|trigo|tapioca/, 'avena'],
  [/cereal|hojuela/, 'cereal'],
  [/pasta|espagueti|spaghetti|fideo|macarron|sopa de pasta/, 'pasta'],
  [/papa|camote/, 'papa'],
  [/elote|esquite|palomita|maiz\b/, 'elote'],
  [/galleta|salmas|habanera/, 'galleta'],
  [/bolillo|telera/, 'bolillo'],
  [/\bpan\b|pan de caja|pan integral|pan tostado|hamburguesa|pita/, 'pan'],
  [/tortilla|tostada|arepa|sope|gordita|tlayuda/, 'tortilla'],
  [/frijol|lenteja|garbanzo|haba|alubia|soya|alverjon|edamame/, 'frijol'],
  [/manzana/, 'manzana'],
  [/platano|banana/, 'platano'],
  [/naranja|mandarina|toronja|lima|limon/, 'naranja'],
  [/fresa|zarzamora|frambuesa|mora|arandano|cereza/, 'fresa'],
  [/\buva|pasas/, 'uva'],
  [/mango/, 'mango'],
  [/pina\b/, 'pina'],
  [/papaya/, 'papaya'],
  [/sandia|melon/, 'sandia'],
  [/\bpera\b/, 'pera'],
  [/brocoli|coliflor/, 'brocoli'],
  [/zanahoria/, 'zanahoria'],
  [/jitomate|tomate/, 'jitomate'],
  [/lechuga|espinaca|acelga|ensalada|verdura cruda|kale|berro/, 'lechuga'],
  [/nopal/, 'nopal'],
  [/calabacita|calabaza|pepino|chayote|ejote/, 'calabacita'],
  [/chile|pimiento|jalapeno|poblano|sriracha|chipotle/, 'chile'],
  [/cebolla|ajo\b/, 'cebolla'],
  [/champinon|seta|hongo/, 'champinon'],
  [/salsa|mostaza|catsup|ketchup|vinagre|soya\b|inglesa/, 'salsa'],
  [/azucar|piloncillo|endulzante/, 'azucar'],
  [/gomita|dulce|caramelo|malvavisco|paleta/, 'dulce'],
  [/chocolate|cocoa/, 'chocolate'],
  [/gelatina|flan|natilla|postre/, 'gelatina'],
  [/verdura/, 'brocoli'],
];

const cache = new Map<string, string | null>();

/** The food sprite for a name or label, or null when nothing specific fits. */
export function foodSprite(text: string): string | null {
  const key = norm(text);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const found = RULES.find(([re]) => re.test(key))?.[1] ?? null;
  cache.set(key, found);
  return found;
}
