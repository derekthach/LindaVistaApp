import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * Car color stable keys (stored in Firestore). Display labels come from i18n (`carColorLabel`).
 */
export interface CarColorOption {
  key: string;
}

export const CAR_COLORS: CarColorOption[] = [
  { key: 'black' },
  { key: 'white' },
  { key: 'gray' },
  { key: 'silver' },
  { key: 'red' },
  { key: 'blue' },
  { key: 'brown' },
  { key: 'green' },
  { key: 'beige' },
  { key: 'yellow' },
  { key: 'gold' },
  { key: 'orange' },
  { key: 'burgundy' },
  { key: 'navy' },
  { key: 'other' },
];

const COLOR_KEY_TO_I18N: Record<string, TranslationKey> = {
  black: 'car_color_black',
  white: 'car_color_white',
  gray: 'car_color_gray',
  silver: 'car_color_silver',
  red: 'car_color_red',
  blue: 'car_color_blue',
  brown: 'car_color_brown',
  green: 'car_color_green',
  beige: 'car_color_beige',
  yellow: 'car_color_yellow',
  gold: 'car_color_gold',
  orange: 'car_color_orange',
  burgundy: 'car_color_burgundy',
  navy: 'car_color_navy',
  other: 'car_color_other',
};

const COLOR_KEYS = new Set(CAR_COLORS.map((c) => c.key));

/** Localized car color label for UI. */
export function carColorLabel(key: string, t: (k: TranslationKey) => string): string {
  const tk = COLOR_KEY_TO_I18N[key];
  return tk ? t(tk) : key;
}

export function isValidCarColorKey(key: string): boolean {
  return COLOR_KEYS.has(key);
}
