import { validateJobOfferInput, validateUrlInput } from '../utils/validation.js';

const runtimeApiBase = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_API_BASE_URL
  : undefined;

export class AnalysisApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'AnalysisApiError';
    this.status = status;
  }
}

function getApiBaseUrl(apiBaseUrl = runtimeApiBase) {
  if (!apiBaseUrl || !apiBaseUrl.trim()) {
    throw new AnalysisApiError('Analysis service is not configured. Set VITE_API_BASE_URL and try again.');
  }
  return apiBaseUrl.replace(/\/$/, '');
}

function errorMessage(status, payload, isUpload) {
  if (status === 413) return isUpload ? 'This file exceeds the 10 MiB upload limit.' : 'This request is too large. Please shorten the text and try again.';
  if (status === 415) return 'Only PDF, PNG, JPG, and JPEG files are supported.';
  if (status === 422) return payload?.detail || 'Please correct the submitted content and try again.';
  if (status === 429) return 'Too many requests. Please wait a moment before trying again.';
  if (status === 503) return 'Analysis is temporarily unavailable. Please try again later.';
  return payload?.detail || 'Analysis could not be completed. Please try again.';
}

async function requestAnalysis(path, options, isUpload) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl(options.apiBaseUrl)}${path}`, options.fetchOptions);
  } catch {
    throw new AnalysisApiError('Unable to connect to the analysis service. Check your connection and try again.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Keep the public error safe if a proxy returns a non-JSON response.
  }
  if (!response.ok) {
    throw new AnalysisApiError(errorMessage(response.status, payload, isUpload), response.status);
  }
  return payload;
}

function toWarningSigns(indicators, evidence) {
  return indicators.map((indicator) => ({
    id: indicator.code,
    title: indicator.code,
    explanation: indicator.message,
    severity: indicator.severity,
    evidence: evidence.find((item) => item.indicator_code === indicator.code)?.detail || ''
  }));
}

export function normalizeApiResponse(data, submittedText, attachedFile = null) {
  const analysis = data.analysis || data;
  const indicators = analysis.indicators || [];
  const evidence = analysis.evidence || [];
  const recommendations = analysis.recommendations || [];

  return {
    isDemo: false,
    isUrlAnalysis: false,
    submittedText: data.extracted_text || submittedText,
    attachedFile: attachedFile ? { name: attachedFile.name, size: attachedFile.size, type: attachedFile.type } : null,
    channel: attachedFile ? (attachedFile.type?.startsWith('image/') ? 'screenshot' : 'document') : 'generic',
    analysis_id: analysis.analysis_id,
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    indicators,
    evidence,
    scam_stage: analysis.scam_stage,
    recommendations,
    summary: analysis.summary,
    disclaimer: analysis.disclaimer,
    riskScore: analysis.risk_score,
    riskLevel: analysis.risk_level,
    scamStage: analysis.scam_stage,
    warningSigns: toWarningSigns(indicators, evidence),
    recommendationSteps: recommendations.map((recommendation, index) => ({ step: index + 1, title: recommendation, description: '' }))
  };
}

export function normalizeUrlApiResponse(data) {
  const indicators = data.indicators || [];
  const recommendations = data.recommendations || [];
  const redirectChain = data.redirect_chain || [];

  return {
    isDemo: false,
    isUrlAnalysis: true,
    submittedText: data.target_url,
    channel: 'url',
    analysis_id: data.analysis_id,
    targetUrl: data.target_url,
    finalUrl: data.final_url,
    isRedirected: Boolean(data.is_redirected || redirectChain.length > 1),
    redirectChain,
    sslInfo: data.ssl_info,
    riskScore: data.risk_score,
    riskLevel: data.risk_level,
    scamStage: data.is_redirected ? 'redirect_gateway' : 'direct_url',
    reputationStatus: data.reputation_status || 'not_checked',
    summary: data.summary,
    disclaimer: data.disclaimer,
    indicators,
    warningSigns: indicators.map((ind) => ({
      id: ind.code,
      title: ind.code.replace(/_/g, ' ').toUpperCase(),
      explanation: ind.message,
      severity: ind.severity,
      category: ind.category,
      evidence: `Indicator Category: ${ind.category}`
    })),
    recommendations,
    recommendationSteps: recommendations.map((rec, index) => ({
      step: index + 1,
      title: rec,
      description: ''
    }))
  };
}

export async function checkJobOffer(rawText, attachedFile = null, apiBaseUrl) {
  const validation = validateJobOfferInput(rawText, attachedFile);
  if (!validation.isValid) {
    throw new AnalysisApiError(validation.error);
  }

  const base = getApiBaseUrl(apiBaseUrl);
  if (attachedFile) {
    const form = new FormData();
    form.append('file', attachedFile);
    const data = await requestAnalysis('/scam/analyze/upload', {
      apiBaseUrl: base,
      fetchOptions: { method: 'POST', body: form }
    }, true);
    return normalizeApiResponse(data, validation.sanitizedText, attachedFile);
  }

  const data = await requestAnalysis('/scam/analyze', {
    apiBaseUrl: base,
    fetchOptions: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        job_text: validation.sanitizedText,
        job_url: null,
        company_name: null,
        contact_details: null
      })
    }
  }, false);
  return normalizeApiResponse(data, validation.sanitizedText);
}

export async function checkUrlCredibility(rawUrl, apiBaseUrl) {
  const validation = validateUrlInput(rawUrl);
  if (!validation.isValid) {
    throw new AnalysisApiError(validation.error);
  }

  const base = getApiBaseUrl(apiBaseUrl);
  const data = await requestAnalysis('/url/analyze', {
    apiBaseUrl: base,
    fetchOptions: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: validation.sanitizedUrl })
    }
  }, false);
  return normalizeUrlApiResponse(data);
}
