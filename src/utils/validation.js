/**
 * Validation and sanitization utilities for CrediHire
 */

export const MAX_INPUT_CHARS = 5000;
export const MIN_INPUT_CHARS = 10;

export function validateJobOfferInput(text, attachedFile = null) {
  const rawString = typeof text === 'string' ? text : '';
  const trimmed = rawString.trim();

  // If a document or file is attached, text is not strictly required
  if (attachedFile) {
    const fileContent = attachedFile.text && attachedFile.text.trim().length > 0 
      ? attachedFile.text.trim() 
      : `[Uploaded Document: ${attachedFile.name} (${attachedFile.size || 'Attached'})]\nReviewing uploaded document for job scam, payment traps, and recruiter impersonation indicators.`;

    const effectiveText = trimmed.length > 0 ? trimmed : fileContent;

    return {
      isValid: true,
      error: null,
      warnings: [],
      sanitizedText: effectiveText.slice(0, MAX_INPUT_CHARS)
    };
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

/**
 * Format timestamp in human readable 12-hour format (e.g. "2:14 PM")
 */
export function getCurrentFormattedTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
