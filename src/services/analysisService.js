/**
 * Primary Analysis Service
 * Bridges user input with remote API or local heuristic detection engine.
 */

import { analyzeJobOfferLocally } from './mockAnalysisService.js';
import { validateJobOfferInput } from '../utils/validation.js';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_API_BASE_URL : undefined;

export async function checkJobOffer(rawText, attachedFile = null) {
  // 1. Client-Side Validation
  const validation = validateJobOfferInput(rawText, attachedFile);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const sanitizedText = validation.sanitizedText;

  // 2. Check if a real remote API backend is configured
  if (API_BASE_URL && API_BASE_URL.trim() !== '') {
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          text: sanitizedText,
          attachedFile: attachedFile ? {
            name: attachedFile.name,
            size: attachedFile.size,
            type: attachedFile.type
          } : null
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis service responded with status: ${response.status}`);
      }

      const rawData = await response.json();
      return normalizeApiResponse(rawData, sanitizedText, attachedFile);
    } catch (apiError) {
      console.warn("Remote analysis service unavailable; using local heuristic analyzer:", apiError.message);
      // Explicit error notification or fallback with disclosure
      const localResult = analyzeJobOfferLocally(sanitizedText, attachedFile);
      localResult.sourceNotice = "Analysis completed via local heuristic security engine (Remote API unreachable).";
      return localResult;
    }
  }

  // 3. Fallback: Local Client-Side Heuristic Engine
  // Simulate standard network latency for realistic evaluation experience (650ms)
  await new Promise(resolve => setTimeout(resolve, 650));
  return analyzeJobOfferLocally(sanitizedText, attachedFile);
}

/**
 * Normalizes remote backend responses into standard CrediHire state structure
 */
function normalizeApiResponse(data, submittedText, attachedFile = null) {
  return {
    isDemo: false,
    submittedText: submittedText,
    attachedFile: attachedFile ? {
      name: attachedFile.name,
      size: attachedFile.size,
      type: attachedFile.type
    } : null,
    timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    channel: data.channel || 'generic',
    riskScore: typeof data.riskScore === 'number' ? Math.min(Math.max(data.riskScore, 0), 100) : 50,
    riskLevel: data.riskLevel || (data.riskScore >= 70 ? 'high' : data.riskScore >= 40 ? 'medium' : 'low'),
    headline: data.headline || (data.riskScore >= 70 ? 'High Risk' : data.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'),
    summary: data.summary || 'Analysis completed.',
    scamStage: data.scamStage || 'evaluation',
    warningSigns: Array.isArray(data.warningSigns) ? data.warningSigns.map((w, idx) => ({
      id: w.id || `sign-${idx}`,
      title: w.title || 'Suspicious Pattern Detected',
      explanation: w.explanation || 'Exercise caution regarding this characteristic.',
      severity: w.severity || 'medium',
      icon: w.icon || 'AlertTriangle',
      evidence: w.evidence || '',
      patternExplainer: w.patternExplainer || {
        whatItIs: w.title || 'Security flag',
        whyItMatters: w.explanation || 'Commonly exploited by malicious recruiters.',
        realWorldTactic: 'Presents misleading opportunities.',
        immediateAction: 'Verify via official company channels.'
      }
    })) : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations.map((r, idx) => ({
      step: r.step || idx + 1,
      title: r.title || 'Verify independently',
      description: r.description || 'Check official public channels before taking action.',
      links: r.links || []
    })) : [
      { step: 1, title: 'Verify the company', description: 'Check the official website and LinkedIn page.' },
      { step: 2, title: 'Do not make any payment', description: 'Legitimate employers never ask for registration fees.' },
      { step: 3, title: 'Report this offer', description: 'Share screenshots on the National Cybercrime Portal.' }
    ],
    verification: data.verification || {
      status: 'unverified',
      message: 'Company identity not independently verified.'
    }
  };
}
