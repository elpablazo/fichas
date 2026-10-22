// Species names and facts (Garden, moments, plant sheets). Kept apart from species.ts so the startup bundle,
// which only needs ids, levels and colors, stays small.

export interface SpeciesText {
  name: string;
  latin: string;
  fact: string;
}

export const SPECIES_TEXT: Record<string, SpeciesText> = {
  margarita: { name: 'Margarita', latin: 'Bellis perennis', fact: 'Abre con el sol y se cierra al anochecer.' },
  girasol: { name: 'Girasol', latin: 'Helianthus annuus', fact: 'De joven, sigue al sol de este a oeste.' },
  cosmos: { name: 'Mirasol', latin: 'Cosmos bipinnatus', fact: 'El cosmos es originario de México.' },
  tulipan: { name: 'Tulipán', latin: 'Tulipa', fact: 'Sigue creciendo aun después de cortado.' },
  dalia: { name: 'Dalia', latin: 'Dahlia pinnata', fact: 'Es la flor nacional de México.' },
  lavanda: { name: 'Lavanda', latin: 'Lavandula angustifolia', fact: 'Su nombre viene del latín lavare: lavar.' },
  nomeolvides: { name: 'Nomeolvides', latin: 'Myosotis', fact: 'Su nombre ya es una promesa.' },
  campanilla: { name: 'Campanilla', latin: 'Ipomoea purpurea', fact: 'Abre por la mañana y cierra por la tarde.' },
  gerbera: { name: 'Gerbera', latin: 'Gerbera jamesonii', fact: 'Es pariente del girasol y la margarita.' },
  violeta: { name: 'Violeta', latin: 'Viola odorata', fact: 'Le dio su nombre a un color.' },
  hortensia: { name: 'Hortensia', latin: 'Hydrangea macrophylla', fact: 'Su color cambia según el suelo.' },
  alcatraz: { name: 'Alcatraz', latin: 'Zantedeschia aethiopica', fact: 'Diego Rivera la pintó una y otra vez.' },
  amapola: {
    name: 'Amapola dorada',
    latin: 'Eschscholzia californica',
    fact: 'Cierra sus pétalos en los días nublados.',
  },
  rosa: { name: 'Rosa', latin: 'Rosa', fact: 'Hay fósiles de rosa de 35 millones de años.' },
  bugambilia: { name: 'Bugambilia', latin: 'Bougainvillea', fact: 'Su color está en las brácteas, no en la flor.' },
  jacaranda: { name: 'Jacaranda', latin: 'Jacaranda mimosifolia', fact: 'Pinta de morado la CDMX en primavera.' },
  nopal: { name: 'Flor de nopal', latin: 'Opuntia ficus-indica', fact: 'Cada flor dura apenas uno o dos días.' },
  galan: { name: 'Galán de noche', latin: 'Cestrum nocturnum', fact: 'Solo perfuma de noche.' },
  orquidea: { name: 'Orquídea', latin: 'Laelia anceps', fact: 'Hay más de 25 mil especies de orquídea.' },
  loto: { name: 'Loto', latin: 'Nelumbo nucifera', fact: 'Sus hojas repelen el agua y el lodo.' },
  magnolia: { name: 'Magnolia', latin: 'Magnolia grandiflora', fact: 'Ya existía antes que las abejas.' },
  cempasuchil: { name: 'Cempasúchil', latin: 'Tagetes erecta', fact: 'Guía a las almas en Día de Muertos.' },
  nochebuena: { name: 'Nochebuena', latin: 'Euphorbia pulcherrima', fact: 'Es de México; lo rosa son hojas.' },
};

export function speciesText(id: string): SpeciesText {
  return SPECIES_TEXT[id] ?? { name: id, latin: '', fact: '' };
}
