type LogLevel = 'info' | 'error';

const REDACT_KEYS = /token|secret|key|password|cookie|auth|session/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (REDACT_KEYS.test(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redact(v);
      }
    });
    return result;
  }
  return value;
}

function emit(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const redacted = data ? redact(data) : {};
  const safeData =
    redacted && typeof redacted === 'object' && !Array.isArray(redacted)
      ? (redacted as Record<string, unknown>)
      : { data: redacted };

  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safeData,
  };
  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

export function logInfo(event: string, data?: Record<string, unknown>) {
  emit('info', event, data);
}

export function logError(event: string, data?: Record<string, unknown>) {
  emit('error', event, data);
}
