import { HttpError } from '@/lib/server/httpError';

export type SpectrumCredentials = {
  projectId: string;
  projectSecret: string;
};

/**
 * Read Spectrum cloud credentials. Fail closed — never invent defaults.
 * Does not log secrets.
 */
export function requireSpectrumCredentials(): SpectrumCredentials {
  const projectId = process.env.SPECTRUM_PROJECT_ID?.trim() ?? '';
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET?.trim() ?? '';
  if (!projectId) {
    throw new HttpError(500, 'SPECTRUM_PROJECT_ID_MISSING', {
      message: 'SPECTRUM_PROJECT_ID is not configured',
    });
  }
  if (!projectSecret) {
    throw new HttpError(500, 'SPECTRUM_PROJECT_SECRET_MISSING', {
      message: 'SPECTRUM_PROJECT_SECRET is not configured',
    });
  }
  return { projectId, projectSecret };
}
