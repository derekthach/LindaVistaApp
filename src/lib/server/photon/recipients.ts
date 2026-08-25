/**
 * Management iMessage recipients (Derek + Dad).
 * Phone numbers come only from server env — never hard-coded or logged.
 */

export type ManagementRecipientKey = 'derek' | 'dad';

/** Production Daily Summary recipients — both get the same formatted message independently. */
export const ACTIVE_MANAGEMENT_RECIPIENTS: readonly ManagementRecipientKey[] = [
  'derek',
  'dad',
] as const;

/** Allow-listed keys for secure Photon connectivity tests (no arbitrary phones). */
export const PHOTON_TEST_RECIPIENT_KEYS: readonly ManagementRecipientKey[] = [
  'derek',
  'dad',
] as const;

const ENV_BY_RECIPIENT: Record<ManagementRecipientKey, string> = {
  derek: 'DAILY_SUMMARY_DEREK_PHONE',
  dad: 'DAILY_SUMMARY_DAD_PHONE',
};

export function managementRecipientEnvName(key: ManagementRecipientKey): string {
  return ENV_BY_RECIPIENT[key];
}

export function isManagementRecipientKey(value: string): value is ManagementRecipientKey {
  return value === 'derek' || value === 'dad';
}

/** Parse request recipient key; only derek|dad accepted. */
export function parseManagementRecipientKey(
  raw: string | null | undefined
): ManagementRecipientKey | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return isManagementRecipientKey(value) ? value : null;
}

/**
 * Read phone for a known recipient key from env (does not require "active").
 * Used by connectivity tests. Never logs the number.
 */
export function getConfiguredRecipientPhone(key: ManagementRecipientKey): string | undefined {
  const raw = process.env[ENV_BY_RECIPIENT[key]];
  const phone = typeof raw === 'string' ? raw.trim() : '';
  return phone || undefined;
}

/**
 * Resolve phone for an *active* production recipient only.
 * Returns undefined when inactive or missing/blank — callers must fail safely.
 */
export function getActiveRecipientPhone(key: ManagementRecipientKey): string | undefined {
  if (!ACTIVE_MANAGEMENT_RECIPIENTS.includes(key)) {
    return undefined;
  }
  return getConfiguredRecipientPhone(key);
}

export function isManagementRecipientActive(key: ManagementRecipientKey): boolean {
  return ACTIVE_MANAGEMENT_RECIPIENTS.includes(key);
}
