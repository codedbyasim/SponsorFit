const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

export class PrivacyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyError";
  }
}

/** Keep Qloo inputs to public cultural names. Reject contact data and long ids. */
export function assertPublicQuery(value: string, label = "Query"): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new PrivacyError(`${label} must be between 2 and 80 characters.`);
  }
  if (EMAIL.test(trimmed) || PHONE.test(trimmed)) {
    throw new PrivacyError("Personal contact details are not sent to Qloo.");
  }
  if (/[<>{}]/.test(trimmed) || trimmed.includes("\n")) {
    throw new PrivacyError(`${label} has unsupported characters.`);
  }
  return trimmed;
}
