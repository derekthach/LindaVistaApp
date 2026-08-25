import { describe, expect, it, afterEach } from 'vitest';
import {
  ACTIVE_MANAGEMENT_RECIPIENTS,
  getActiveRecipientPhone,
  getConfiguredRecipientPhone,
  isManagementRecipientActive,
  parseManagementRecipientKey,
} from './recipients';

describe('photon recipients (Derek + Dad)', () => {
  const prevDerek = process.env.DAILY_SUMMARY_DEREK_PHONE;
  const prevDad = process.env.DAILY_SUMMARY_DAD_PHONE;

  afterEach(() => {
    if (prevDerek === undefined) delete process.env.DAILY_SUMMARY_DEREK_PHONE;
    else process.env.DAILY_SUMMARY_DEREK_PHONE = prevDerek;
    if (prevDad === undefined) delete process.env.DAILY_SUMMARY_DAD_PHONE;
    else process.env.DAILY_SUMMARY_DAD_PHONE = prevDad;
  });

  it('activates Derek and Dad', () => {
    expect(ACTIVE_MANAGEMENT_RECIPIENTS).toEqual(['derek', 'dad']);
    expect(isManagementRecipientActive('derek')).toBe(true);
    expect(isManagementRecipientActive('dad')).toBe(true);
  });

  it('resolves Derek and Dad phones when configured', () => {
    process.env.DAILY_SUMMARY_DEREK_PHONE = ' +15551234567 ';
    process.env.DAILY_SUMMARY_DAD_PHONE = ' +15557654321 ';
    expect(getActiveRecipientPhone('derek')).toBe('+15551234567');
    expect(getActiveRecipientPhone('dad')).toBe('+15557654321');
  });

  it('returns undefined when Dad phone is missing (safe config failure)', () => {
    process.env.DAILY_SUMMARY_DEREK_PHONE = '+15551234567';
    delete process.env.DAILY_SUMMARY_DAD_PHONE;
    expect(getActiveRecipientPhone('dad')).toBeUndefined();
    expect(getConfiguredRecipientPhone('dad')).toBeUndefined();
  });

  it('returns undefined when Derek phone is missing', () => {
    delete process.env.DAILY_SUMMARY_DEREK_PHONE;
    expect(getActiveRecipientPhone('derek')).toBeUndefined();
  });

  it('parses only allow-listed recipient keys', () => {
    expect(parseManagementRecipientKey('derek')).toBe('derek');
    expect(parseManagementRecipientKey('DAD')).toBe('dad');
    expect(parseManagementRecipientKey('mom')).toBeNull();
    expect(parseManagementRecipientKey('+15551234567')).toBeNull();
    expect(parseManagementRecipientKey(null)).toBeNull();
  });
});
