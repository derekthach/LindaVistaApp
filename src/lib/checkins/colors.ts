/**
 * Car color options with stable keys (stored in Firestore) and bilingual labels (EN/ES).
 */
export interface CarColorOption {
  key: string;
  label: string;
}

export const CAR_COLORS: CarColorOption[] = [
  { key: 'black', label: 'Black/Negro' },
  { key: 'white', label: 'White/Blanco' },
  { key: 'gray', label: 'Gray/Gris' },
  { key: 'silver', label: 'Silver/Plata' },
  { key: 'red', label: 'Red/Rojo' },
  { key: 'blue', label: 'Blue/Azul' },
  { key: 'brown', label: 'Brown/Marrón' },
  { key: 'green', label: 'Green/Verde' },
  { key: 'beige', label: 'Beige/Beige' },
  { key: 'yellow', label: 'Yellow/Amarillo' },
  { key: 'gold', label: 'Gold/Dorado' },
  { key: 'orange', label: 'Orange/Naranja' },
  { key: 'burgundy', label: 'Burgundy/Borgonia' },
  { key: 'navy', label: 'Navy/Azul Marino' },
  { key: 'other', label: 'Other/Otro' },
];

const COLOR_MAP = new Map(CAR_COLORS.map((c) => [c.key, c]));

export function getCarColorLabel(key: string): string {
  return COLOR_MAP.get(key)?.label ?? key;
}

export function isValidCarColorKey(key: string): boolean {
  return COLOR_MAP.has(key);
}
