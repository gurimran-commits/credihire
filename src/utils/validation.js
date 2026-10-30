/**
 * Validation and sanitization utilities for CrediHire
 */

export const MAX_INPUT_CHARS = 12_000;
export const MIN_INPUT_CHARS = 10;
export const MAX_URL_CHARS = 2_048;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

export function validateUploadFile(file) {
  const name = typeof file?.name === 'string' ? file.name : '';
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (!SUPPORTED_UPLOAD_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: 'Only PDF, PNG, JPG, and JPEG files are supported.' };
  }
  if (typeof file?.size !== 'number' || file.size === 0) {
    return { isValid: false, error: 'Please choose a non-empty file.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { isValid: false, error: 'This file exceeds the 10 MiB upload limit.' };
  }
  return { isValid: true, error: null };
}

export function validateJobOfferInput(text, attachedFile = null) {
  const rawString = typeof text === 'string' ? text : '';
  const trimmed = rawString.trim();

  if (attachedFile) {
    const fileValidation = validateUploadFile(attachedFile);
    return { ...fileValidation, warnings: [], sanitizedText: trimmed };
  }

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: "Please paste a job offer message, or click the file icon to upload a document/screenshot."
    };
  }

  if (trimmed.length < MIN_INPUT_CHARS) {
    return {
      isValid: false,
      error: "Please provide a little more text (at least 10 characters) so patterns can be identified."
    };
  }

  if (trimmed.length > MAX_INPUT_CHARS) {
    return {
      isValid: false,
      error: `Input exceeds maximum limit of ${MAX_INPUT_CHARS} characters (currently ${trimmed.length}).`
    };
  }

  // Check for potential accidental PII paste (Passphrases, 16-digit cards, etc.)
  const piiWarnings = [];
  const creditCardRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/;
  const otpPasswordRegex = /\b(?:my otp is|password is|pin is)\s*[:=]?\s*\w+/i;

  if (creditCardRegex.test(trimmed)) {
    piiWarnings.push("Potential credit or debit card number detected. Do not submit actual card numbers.");
  }
  if (otpPasswordRegex.test(trimmed)) {
    piiWarnings.push("Potential personal password or OTP detected. Please remove credentials before submitting.");
  }

  return {
    isValid: true,
    error: null,
    warnings: piiWarnings,
    sanitizedText: trimmed
  };
}

export function validateUrlInput(rawUrl) {
  const rawString = typeof rawUrl === 'string' ? rawUrl : '';
  const trimmed = rawString.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Please paste a recruitment website URL to analyze.'
    };
  }

  if (trimmed.length > MAX_URL_CHARS) {
    return {
      isValid: false,
      error: `URL exceeds the maximum limit of ${MAX_URL_CHARS} characters.`
    };
  }

  const colonIdx = trimmed.indexOf(':');
  const slashIdx = trimmed.indexOf('/');
  if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
    const scheme = trimmed.slice(0, colonIdx).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return {
        isValid: false,
        error: 'Only http:// and https:// URLs are supported.'
      };
    }
  }

  // Check for obvious whitespace or control characters
  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      error: 'URL cannot contain spaces.'
    };
  }

  return {
    isValid: true,
    error: null,
    sanitizedUrl: trimmed
  };
}

/**
 * Format timestamp in human readable 12-hour format (e.g. "2:14 PM")
 */
export function getCurrentFormattedTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
