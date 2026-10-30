import { useState, useCallback } from 'react';
import { INITIAL_DEMO_DATA } from '../data/demoAnalysis.js';
import { checkJobOffer } from '../services/analysisService.js';

export function useAnalysis() {
  const [result, setResult] = useState(INITIAL_DEMO_DATA);
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (customText, customFile) => {
    const textToAnalyze = customText !== undefined ? customText : inputText;
    const fileToAnalyze = customFile !== undefined ? customFile : attachedFile;
    setError(null);

    // If neither text nor document is present
    if ((!textToAnalyze || textToAnalyze.trim() === '') && !fileToAnalyze) {
      setError("Please paste a job offer message, or click the file icon to upload a document/screenshot.");
      return null;
    }

    setIsLoading(true);
    try {
      const analysisData = await checkJobOffer(textToAnalyze, fileToAnalyze);
      setResult(analysisData);
      // Smooth scroll to results
      const resultsEl = document.getElementById('results-section');
      if (resultsEl) {
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return analysisData;
    } catch (err) {
      setError(err.message || "Failed to analyze offer. Please check your text and try again.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [inputText, attachedFile]);

  const loadPreset = useCallback(async (preset) => {
    setAttachedFile(null);
    setInputText(preset.text);
    setError(null);
    return await analyze(preset.text, null);
  }, [analyze]);

  const resetToDemo = useCallback(() => {
    setResult(INITIAL_DEMO_DATA);
    setInputText('');
    setAttachedFile(null);
    setError(null);
  }, []);

  const clearInput = useCallback(() => {
    setInputText('');
    setAttachedFile(null);
    setError(null);
  }, []);

  return {
    result,
    setResult,
    inputText,
    setInputText,
    attachedFile,
    setAttachedFile,
    isLoading,
    error,
    setError,
    analyze,
    loadPreset,
    resetToDemo,
    clearInput
  };
}
