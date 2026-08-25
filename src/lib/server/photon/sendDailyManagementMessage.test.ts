import { describe, expect, it } from 'vitest';
import { hasFailedManagementDelivery } from './sendDailyManagementMessage';
import type { DailyManagementDeliveryResult } from './sendDailyManagementMessage';

function row(
  over: Partial<DailyManagementDeliveryResult> & Pick<DailyManagementDeliveryResult, 'recipientKey' | 'status'>
): DailyManagementDeliveryResult {
  return {
    durationMs: 1,
    ...over,
  };
}

describe('hasFailedManagementDelivery', () => {
  it('is false when all sent or skipped', () => {
    expect(
      hasFailedManagementDelivery([
        row({ recipientKey: 'derek', status: 'sent' }),
        row({ recipientKey: 'dad', status: 'skipped', skipReason: 'already_sent' }),
      ])
    ).toBe(false);
  });

  it('is true when any recipient failed', () => {
    expect(
      hasFailedManagementDelivery([
        row({ recipientKey: 'derek', status: 'sent' }),
        row({ recipientKey: 'dad', status: 'failed', error: 'x' }),
      ])
    ).toBe(true);
  });
});
