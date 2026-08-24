import { describe, expect, it, afterEach } from 'vitest';
import {
  ACTIVE_MANAGEMENT_RECIPIENTS,
  getActiveRecipientPhone,
  isManagementRecipientActive,
} from './recipients';

describe('photon recipients (testing phase)', () => {
  const prevDerek = process.env.DAILY_SUMMARY_DEREK_PHONE;
  const prevDad = process.env.DAILY_SUMMARY_DAD_PHONE;

  afterEach(() => {
    if (prevDerek === undefined) delete process.env.DAILY_SUMMARY_DEREK_PHONE;
    else process.env.DAILY_SUMMARY_DEREK_PHONE = prevDerek;
    if (prevDad === undefined) delete process.env.DAILY_SUMMARY_DAD_PHONE;
    else process.env.DAILY_SUMMARY_DAD_PHONE = prevDad;
  });

  it('activates only Derek', () => {
    expect(ACTIVE_MANAGEMENT_RECIPIENTS).toEqual(['derek']);
    expect(isManagementRecipientActive('derek')).toBe(true);
    expect(isManagementRecipientActive('dad')).toBe(false);
  });

  it('resolves Derek phone when configured', () => {
    process.env.DAILY_SUMMARY_DEREK_PHONE = ' +15551234567 ';
    expect(getActiveRecipientPhone('derek')).toBe('+15551234567');
  });

  it('never resolves Dad phone even when env is set', () => {
    process.env.DAILY_SUMMARY_DAD_PHONE = '+15557654321';
    expect(getActiveRecipientPhone('dad')).toBeUndefined();
  });

  it('returns undefined when Derek phone is missing', () => {
    delete process.env.DAILY_SUMMARY_DEREK_PHONE;
    expect(getActiveRecipientPhone('derek')).toBeUndefined();
  });
});
