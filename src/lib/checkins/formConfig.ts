import type { CheckInType } from './types';
import { STAFF_MEMBERS } from './constants';

export interface FieldConfig {
  name: string;
  labelKey: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  required: boolean;
  /** For select: array of { value, labelKey or label } */
  options?: { value: string; label?: string; labelKey?: string }[];
}

export interface FormConfig {
  type: CheckInType;
  titleKey: string;
  submitLabelKey: string;
  fields: FieldConfig[];
}

/** Form config for simple (food/beer) check-in: date, time, staff only */
export const SIMPLE_FORM_FIELDS: FieldConfig[] = [
  { name: 'date', labelKey: 'date', type: 'text', required: true },
  { name: 'time', labelKey: 'time', type: 'text', required: true },
  {
    name: 'staff_name',
    labelKey: 'staff_name',
    type: 'select',
    required: true,
    options: [
      { value: '', labelKey: 'staff_select_placeholder' },
      ...STAFF_MEMBERS.map((name) => ({ value: name, label: name })),
    ],
  },
];

export const FORM_CONFIG: Record<CheckInType, FormConfig> = {
  room: {
    type: 'room',
    titleKey: 'room_checkin_title',
    submitLabelKey: 'submit',
    fields: [], // Room uses dedicated form with full fields
  },
  food: {
    type: 'food',
    titleKey: 'food_checkin_title',
    submitLabelKey: 'submit',
    fields: SIMPLE_FORM_FIELDS,
  },
  beer: {
    type: 'beer',
    titleKey: 'beer_checkin_title',
    submitLabelKey: 'submit',
    fields: SIMPLE_FORM_FIELDS,
  },
};
