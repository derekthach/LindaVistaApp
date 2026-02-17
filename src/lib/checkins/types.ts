export type CheckInType = 'room' | 'food' | 'beer';

export const CHECKIN_TYPE_SLUGS: Record<CheckInType, string> = {
  room: 'room',
  food: 'food',
  beer: 'beer',
} as const;

export const VALID_CHECKIN_TYPE_SLUGS = ['room', 'food', 'beer'] as const;

export function isCheckInType(slug: string): slug is CheckInType {
  return VALID_CHECKIN_TYPE_SLUGS.includes(slug as CheckInType);
}
