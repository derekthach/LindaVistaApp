export {
  SHIFT_TIMEZONE,
  SHIFT_IDS,
  SHIFT_DEFINITIONS,
  getShiftWindow,
  getShiftIdForLocalMinutes,
  getShiftIdForTimeHHmm,
  getBusinessDateWindow,
  isInstantInHalfOpenRange,
  getShiftDisplayLabel,
  getShiftDisplayTitle,
  type ShiftId,
  type ShiftDefinition,
  type ShiftWindow,
} from './definitions';

export type { ShiftSummary, ShiftSummaryDoc, RoomTurnoverRecord } from './types';
export { shiftSummaryDocId, toShiftSummaryDoc } from './types';

export {
  calculateShiftSummary,
  calculateDayShiftSummaries,
  countRoomsTurnedOverInWindow,
  sumShiftMetrics,
  type CalculateShiftSummaryInput,
} from './calculateShiftSummary';

export { formatShiftSummary, shiftDisplayLabel } from './formatShiftSummary';
export type {
  DailySummary,
  IncompleteDailySummary,
  DailySummaryResult,
  DailySummaryDoc,
} from './dailyTypes';
export {
  dailySummaryDocId,
  buildShiftSummaryIds,
  toDailySummaryDoc,
  dailySummaryHasViewCheckinsBreakdown,
} from './dailyTypes';

export {
  calculateDailySummary,
  isCompleteDailySummary,
  formatMissingShiftSummariesError,
  type DailySummaryViewCheckinsInput,
} from './calculateDailySummary';

export { formatDailySummary, formatIncompleteDailySummary } from './formatDailySummary';
export { formatDailyManagementMessage } from './formatDailyManagementMessage';
export {
  motivationalQuotes,
  getQuoteOfTheDay,
  getQuoteIndexForBusinessDate,
  formatQuoteOfTheDaySection,
  type MotivationalQuote,
} from '@/lib/motivationalQuotes';

export {
  getPreviousPuertoRicoBusinessDate,
  isShiftId,
} from './cronTarget';
