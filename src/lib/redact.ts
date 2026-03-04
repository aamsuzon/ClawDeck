const SECRET_KEY_PATTERN = /(token|api[_-]?key|secret|password|auth|webhook_url)/i;

function maskValue(value: string): string {
  if (value.length <= 6) {
    return "***";
  }

  const head = value.slice(0, 3);
  const tail = value.slice(-2);
  return `${head}${"*".repeat(Math.max(3, value.length - 5))}${tail}`;
}

export function redactObject<T>(input: T): T {
  return redactByKey("", input) as T;
}

function redactByKey(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (SECRET_KEY_PATTERN.test(key)) {
      return maskValue(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactByKey(key, item));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = redactByKey(childKey, childValue);
    }
    return output;
  }

  return value;
}

export function isSecretLikeKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}
