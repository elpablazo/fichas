// JEV (TypeSafe System One): typed, calibrated decisions in ~70–500 ms instead of generated text.
// Used only for live feedback while the owner types: which food groups a phrase belongs to, so the app shows it
// understood before the portions arrive. Portions always come from the plan table (local matcher or meal AI).
// API: POST {JEV_BASE_URL}/v1/systemone with typed questions; each `noul` answer is a probability of "yes".
import { z } from 'zod';
import { type Classified, FOOD_GROUPS, type FoodGroup } from '../../shared/ai-schema';

export const JEV_VERSION = 'groups-1';
const DEFAULT_BASE = 'https://api.typesafe.ai';
const DEFAULT_MODEL = 'jev-latest';
/** A group counts when JEV is more sure than not. */
const YES = 0.5;

const GROUPS: Record<FoodGroup, string> = {
  carb: 'Contiene cereales o tubérculos: tortilla, pan, arroz, pasta, avena, papa, elote, tostada o galletas.',
  protein: 'Contiene carne, pollo, pescado, mariscos, huevo, jamón, atún o queso.',
  legume: 'Contiene frijoles, lentejas, garbanzos, habas o soya.',
  dairy: 'Contiene leche o yogur.',
  fruit: 'Contiene fruta: manzana, plátano, piña, mango, papaya, uvas o jugo de fruta.',
  veg: 'Contiene verduras: nopal, jitomate, lechuga, calabaza, brócoli, zanahoria, chile o cebolla en cantidad.',
  fat: 'Contiene grasa: aceite, aguacate, mantequilla, crema, mayonesa o algo frito.',
  nuts: 'Contiene nueces, almendras, cacahuates, semillas o chocolate.',
  sugar: 'Contiene azúcar añadida: refresco, dulces, postre, pan dulce, miel, mermelada o agua de sabor.',
};

const Answer = z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) });
const JevOutput = z.object({ answers: z.record(z.string(), Answer) });

export class JevUnavailable extends Error {}

/** Food groups of one phrase ("3 tacos de pollo" → carb, protein). One call, eleven yes/no questions. */
export async function classifyFood(env: Env, text: string): Promise<Classified> {
  if (!env.JEV_API_KEY) throw new JevUnavailable('JEV_API_KEY missing');
  const questions: Record<string, { type: 'noul'; instructions: string }> = {
    food: { type: 'noul', instructions: 'El texto describe algo que una persona comió o bebió.' },
    free: {
      type: 'noul',
      instructions: 'Es solo agua, café o té sin azúcar, refresco sin azúcar, especias, salsa o limón.',
    },
  };
  for (const g of FOOD_GROUPS) questions[g] = { type: 'noul', instructions: GROUPS[g] };
  const response = await fetch(`${(env.JEV_BASE_URL || DEFAULT_BASE).replace(/\/$/, '')}/v1/systemone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.JEV_MODEL || DEFAULT_MODEL,
      state: { comida: text, contexto: 'Lo que una persona en México anotó que comió.' },
      questions,
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new JevUnavailable(`JEV ${response.status}`);
  const { answers } = JevOutput.parse(await response.json());
  const p = (k: string) => answers[k]?.noul ?? 0;
  const free = p('free') >= 0.6;
  return {
    text,
    food: p('food'),
    free,
    groups: free ? [] : FOOD_GROUPS.filter((g) => p(g) >= YES),
  };
}
