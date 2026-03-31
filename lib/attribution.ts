type RawGitUser = {
  name?: unknown;
  email?: unknown;
  [key: string]: unknown;
};

export type GitUserAttribution = {
  name: string;
  email: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeGitUser(input: RawGitUser | null | undefined): GitUserAttribution | null {
  if (!input || typeof input !== 'object') return null;

  const name = asTrimmedString(input.name);
  const email = asTrimmedString(input.email).toLowerCase();

  if (!name || !email) return null;

  return { name, email };
}

export function sanitizeAttributionPayload(
  payload: { gitUser?: RawGitUser | null } | null | undefined
): { gitUser?: GitUserAttribution } {
  const gitUser = sanitizeGitUser(payload?.gitUser);
  if (!gitUser) return {};
  return { gitUser };
}
