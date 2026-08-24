/**
 * Management iMessage recipients.
 *
 * Testing phase: ONLY Derek is active. Dad may have an env var configured
 * but must not be messaged, tracked, or attempted until explicitly enabled.
 */

export type ManagementRecipientKey = 'derek' | 'dad';

/** Active recipients for this testing phase. Enable Dad later by adding "dad". */
export const ACTIVE_MANAGEMENT_RECIPIENTS: readonly ManagementRecipientKey[] = ['derek'] as const;

const ENV_BY_RECIPIENT: Record<ManagementRecipientKey, string> = {
  derek: 'DAILY_SUMMARY_DEREK_PHONE',
  dad: 'DAILY_SUMMARY_DAD_PHONE',
};

export function managementRecipientEnvName(key: ManagementRecipientKey): string {
  return ENV_BY_RECIPIENT[key];
}

/**
 * Resolve phone for an *active* recipient only.
 * Returns undefined when missing/blank — callers must fail safely.
 * Never logs the phone number.
 */
export function getActiveRecipientPhone(key: ManagementRecipientKey): string | undefined {
  if (!ACTIVE_MANAGEMENT_RECIPIENTS.includes(key)) {
    return undefined;
  }
  const raw = process.env[ENV_BY_RECIPIENT[key]];
  const phone = typeof raw === 'string' ? raw.trim() : '';
  return phone || undefined;
}

export function isManagementRecipientActive(key: ManagementRecipientKey): boolean {
  return ACTIVE_MANAGEMENT_RECIPIENTS.includes(key);
}
