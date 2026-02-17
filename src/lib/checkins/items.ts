/**
 * Config-driven item options for Food & Beverage and Beer check-ins.
 * IDs are stable (do not change when labels change). Labels are bilingual.
 */

export interface ItemOption {
  id: string;
  label: { en: string; es: string };
}

/** Food & Beverage dropdown items (config-driven). */
export const FOOD_ITEMS: ItemOption[] = [
  { id: 'food_jugos', label: { en: 'Jugos (Juices)', es: 'Jugos' } },
  { id: 'food_agua_de_coco', label: { en: 'Agua de Coco', es: 'Agua de Coco' } },
  { id: 'food_refrescos', label: { en: 'Refrescos (Soda)', es: 'Refrescos (Soda)' } },
  { id: 'food_agua', label: { en: 'Agua (Water)', es: 'Agua' } },
  { id: 'food_agua_tonica', label: { en: 'Agua Tonica (Sparkling)', es: 'Agua Tónica (Sparkling)' } },
  { id: 'food_frito_lay', label: { en: 'Frito Lay', es: 'Frito Lay' } },
  { id: 'food_travel_kit', label: { en: 'Travel Kit', es: 'Travel Kit' } },
  { id: 'food_alkaseltzer', label: { en: 'Alkaseltzer', es: 'Alkaseltzer' } },
  { id: 'food_panadol', label: { en: 'Panadol (Acetaminophen)', es: 'Panadol (Acetaminofén)' } },
  { id: 'food_condones', label: { en: 'Condones (Condoms)', es: 'Condones (Condones)' } },
];

/** Beer dropdown items. Duplicate "Lambrusco" deduped to one option. */
export const BEER_ITEMS: ItemOption[] = [
  // Beers
  { id: 'beer_medalla_botella_10oz', label: { en: 'Medalla Botella 10oz', es: 'Medalla Botella 10oz' } },
  { id: 'beer_busch_10oz', label: { en: 'Busch 10oz', es: 'Busch 10oz' } },
  { id: 'beer_coors_light_botella_12oz', label: { en: 'Coors Light Botella 12oz', es: 'Coors Light Botella 12oz' } },
  { id: 'beer_coors_light_10oz', label: { en: 'Coors Light 10oz', es: 'Coors Light 10oz' } },
  { id: 'beer_heineken_botella_12oz', label: { en: 'Heineken Botella 12oz', es: 'Heineken Botella 12oz' } },
  { id: 'beer_corona_light_botella_12oz', label: { en: 'Corona Light Botella 12oz', es: 'Corona Light Botella 12oz' } },
  { id: 'beer_michelob_botella_12oz', label: { en: 'Michelob Botella 12 oz', es: 'Michelob Botella 12 oz' } },
  // Wines (Lambrusco deduped to one; Lambrusco 750 ml separate)
  { id: 'beer_lambrusco', label: { en: 'Lambrusco', es: 'Lambrusco' } },
  { id: 'beer_lambrusco_750ml', label: { en: 'Lambrusco 750 ml', es: 'Lambrusco 750 ml' } },
  // Caneca (Mug)
  { id: 'beer_caneca_finlandia', label: { en: 'Finlandia', es: 'Finlandia' } },
  { id: 'beer_caneca_black_label', label: { en: 'Black Label', es: 'Black Label' } },
  { id: 'beer_caneca_dewars', label: { en: 'Dewars', es: 'Dewars' } },
  { id: 'beer_caneca_bacardi', label: { en: 'Bacardi', es: 'Bacardi' } },
  { id: 'beer_caneca_don_q', label: { en: 'Don Q', es: 'Don Q' } },
  { id: 'beer_caneca_felipe_il', label: { en: 'Felipe Il', es: 'Felipe Il' } },
  { id: 'beer_caneca_gasolina_palo_ready', label: { en: 'Gasolina/Palo Ready', es: 'Gasolina/Palo Ready' } },
];
