import { HttpError } from './httpError';

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(500, 'ENV_MISSING', { missing: [name] });
  }
  return value;
}

export function requireEnvs(names: string[]) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new HttpError(500, 'ENV_MISSING', { missing });
  }
  return true;
}
