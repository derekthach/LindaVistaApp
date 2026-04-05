/** Display name aligned with STAFF_MEMBERS / checkout validation. */
export function formatEmployeeNameSnapshot(fullName: string, nickname: string | null | undefined): string {
  const name = fullName.trim();
  const nick = nickname?.trim();
  if (!name) return nick ?? '';
  if (nick) return `${name} (${nick})`;
  return name;
}
