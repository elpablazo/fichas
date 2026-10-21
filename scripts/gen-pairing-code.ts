// Prints a new owner pairing code: 6 random Spanish words (no accents, easy to type on a phone).
// Usage: npm run gen:code  → then `npm run cf -- secret put OWNER_PAIRING_CODE` and paste it.
import { randomInt } from 'node:crypto';

export const WORDS = (
  'mango nopal tortilla pepino limon cacao canela vainilla papaya guayaba ciruela durazno frijol elote chile ' +
  'cilantro comal cazuela jarra taza plato cuchara canasta mercado tianguis fonda jardin flor petalo girasol dalia ' +
  'nube lluvia sol luna estrella rio lago monte volcan bosque pino roble cedro palma arena piedra perla coral ola ' +
  'brisa viento trueno rayo nieve hielo fuego humo barro ladrillo ventana puerta techo patio balcon escalera pasillo ' +
  'mesa silla banco cama almohada cobija sombrero rebozo huarache guitarra trompeta marimba tambor cometa globo ' +
  'pelota trompo canica loteria domino libro cuaderno lapiz papel tinta carta sobre timbre mapa brujula faro barco ' +
  'remo vela ancla puente camino sendero plaza kiosco fuente campana reloj cohete avion tren colibri jaguar ajolote ' +
  'tortuga delfin ballena pulpo cangrejo conejo ardilla venado zorro lobo oso buho aguila gorrion paloma loro tucan ' +
  'iguana abeja mariposa caracol hormiga grillo naranja toronja sandia melon fresa uva cereza pera manzana kiwi'
).split(' ');

export function pairingCode(n = 6): string {
  return Array.from({ length: n }, () => WORDS[randomInt(WORDS.length)]).join(' ');
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(pairingCode());
