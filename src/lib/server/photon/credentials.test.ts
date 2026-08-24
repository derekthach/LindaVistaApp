import { describe, expect, it, afterEach } from 'vitest';
import { requireSpectrumCredentials } from './credentials';
import { HttpError } from '@/lib/server/httpError';

describe('requireSpectrumCredentials', () => {
  const prevId = process.env.SPECTRUM_PROJECT_ID;
  const prevSecret = process.env.SPECTRUM_PROJECT_SECRET;

  afterEach(() => {
    if (prevId === undefined) delete process.env.SPECTRUM_PROJECT_ID;
    else process.env.SPECTRUM_PROJECT_ID = prevId;
    if (prevSecret === undefined) delete process.env.SPECTRUM_PROJECT_SECRET;
    else process.env.SPECTRUM_PROJECT_SECRET = prevSecret;
  });

  it('fails safely when project id is missing', () => {
    delete process.env.SPECTRUM_PROJECT_ID;
    process.env.SPECTRUM_PROJECT_SECRET = 'secret';
    expect(() => requireSpectrumCredentials()).toThrow(HttpError);
    try {
      requireSpectrumCredentials();
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).code).toBe('SPECTRUM_PROJECT_ID_MISSING');
    }
  });

  it('fails safely when project secret is missing', () => {
    process.env.SPECTRUM_PROJECT_ID = 'proj';
    delete process.env.SPECTRUM_PROJECT_SECRET;
    try {
      requireSpectrumCredentials();
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).code).toBe('SPECTRUM_PROJECT_SECRET_MISSING');
    }
  });

  it('returns credentials when both are set', () => {
    process.env.SPECTRUM_PROJECT_ID = 'proj';
    process.env.SPECTRUM_PROJECT_SECRET = 'secret';
    expect(requireSpectrumCredentials()).toEqual({
      projectId: 'proj',
      projectSecret: 'secret',
    });
  });
});
