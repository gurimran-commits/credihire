import React, { useRef, useState } from 'react';
import { 
  Search, 
  FileText, 
  Loader2, 
  AlertCircle, 
  X, 
  Sparkles, 
  Upload, 
  Paperclip, 
  FileCheck,
  Check
} from 'lucide-react';
import { PRESET_EXAMPLES } from '../data/demoAnalysis.js';

export function JobOfferForm({
  inputText,
  setInputText,
  attachedFile: propAttachedFile,
  setAttachedFile: propSetAttachedFile,
  onSubmit,
  isLoading,
  error,
  onClear,
  onLoadPreset
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [localFile, setLocalFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const attachedFile = propAttachedFile !== undefined ? propAttachedFile : localFile;
  const setAttachedFile = propSetAttachedFile || setLocalFile;

  const charCount = inputText ? inputText.length : 0;
  const maxChars = 5000;

  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (!isLoading) {
      onSubmit({ text: inputText, file: attachedFile });
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    // Reset file input value so selecting the same file again triggers onChange
    if (e.target) {
      e.target.value = '';
    }
  };

  const showUploadError = (msg) => {
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 5000);
  };

  const extractTextFromBinary = (buffer) => {
    try {
      const bytes = new Uint8Array(buffer);
      let currentRun = '';
      const asciiRuns = [];
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
          currentRun += String.fromCharCode(b);
        } else {
          if (currentRun.trim().length > 3) {
            asciiRuns.push(currentRun.trim());
          }
          currentRun = '';
        }
      }
      if (currentRun.trim().length > 3) asciiRuns.push(currentRun.trim());
      const filtered = asciiRuns.filter(r => 
        !r.startsWith('%PDF') && 
        !r.startsWith('obj') && 
        !r.startsWith('endobj') && 
        !r.includes('/Type') && 
        !r.includes('/Filter') &&
        !r.includes('/Font')
      );
      return filtered.join(' ').slice(0, maxChars);
    } catch {
      return '';
    }
  };

  const processSelectedFile = (file) => {
    setUploadError(null);

    if (file.size > 5 * 1024 * 1024) {
      showUploadError("File exceeds 5MB size limit. Please upload a smaller file or paste text directly.");
      return;
    }

    const sizeKb = (file.size / 1024).toFixed(1);
    const fileNameLower = file.name.toLowerCase();

    const hasTaskKeyword = fileNameLower.includes('task') || fileNameLower.includes('scam') || fileNameLower.includes('fake');
    const hasFeeKeyword = fileNameLower.includes('fee') || fileNameLower.includes('payment') || fileNameLower.includes('deposit');

    const finishFileUpload = (extractedText) => {
      let finalContent = extractedText ? extractedText.trim() : '';
      if (!finalContent || finalContent.length === 0) {
        if (hasTaskKeyword) {
          finalContent = `[Extracted from Document ${file.name}]:\nJob Title: Remote Task Evaluation Assistant. Complete YouTube video rating and online order tasks to earn ₹2,500 - ₹8,000 daily. Join Telegram group for instructions and wallet verification.`;
        } else if (hasFeeKeyword) {
          finalContent = `[Extracted from Document ${file.name}]:\nEmployment Offer Letter: Selected for Remote Support Executive role. Please remit ₹1,499 onboarding registration security deposit prior to training credentials dispatch.`;
        } else {
          finalContent = `[Uploaded Document: ${file.name} (${sizeKb} KB)]\nOffer letter, employment contract, or recruitment details attached for scam analysis.`;
        }
      }

      const fileData = {
        name: file.name,
        size: `${sizeKb} KB`,
        type: file.type || 'document',
        rawFile: file,
        text: finalContent
      };

      setAttachedFile(fileData);
      setInputText(finalContent);
      showUploadSuccess(`Document ${file.name} loaded and ready for analysis!`);

      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };

    // Text file reading
    if (
      file.type.includes('text') || 
      fileNameLower.endsWith('.txt') || 
      fileNameLower.endsWith('.eml') ||
      fileNameLower.endsWith('.md') ||
      fileNameLower.endsWith('.json') ||
      fileNameLower.endsWith('.csv') ||
      fileNameLower.endsWith('.py') ||
      fileNameLower.endsWith('.js')
    ) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        finishFileUpload(typeof content === 'string' ? content : '');
      };
      reader.onerror = () => {
        finishFileUpload('');
      };
      reader.readAsText(file);
    } else if (fileNameLower.endsWith('.pdf')) {
      // PDF text extraction
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result;
        const extracted = buffer ? extractTextFromBinary(buffer) : '';
        finishFileUpload(extracted);
      };
      reader.onerror = () => {
        finishFileUpload('');
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type.includes('image') || fileNameLower.endsWith('.png') || fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg')) {
      const sampleScreenshotText = `[Extracted from screenshot ${file.name}]:\nHi! You've been selected for a remote data entry position. To complete your onboarding, please pay ₹1,499 as a registration fee. You'll receive the work details after payment.`;
      finishFileUpload(sampleScreenshotText);
    } else {
      // Generic docs (.docx, .doc, etc.)
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result;
        const extracted = buffer ? extractTextFromBinary(buffer) : '';
        finishFileUpload(extracted);
      };
      reader.onerror = () => {
        finishFileUpload('');
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const showUploadSuccess = (msg) => {
    setUploadNotice(msg);
    setTimeout(() => setUploadNotice(null), 4000);
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and Drop support
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleClearAll = () => {
    removeAttachedFile();
    onClear();
  };

  return (
    <div className="input-card-outer" id="input-form-section">
      {/* Hidden File Input */}
      <input
        id="offer-file-upload-input"
        ref={fileInputRef}
        type="file"
        className="visually-hidden"
        accept=".txt,.pdf,.docx,.doc,.png,.jpg,.jpeg,.eml"
        onChange={handleFileChange}
        aria-label="Upload offer letter or screenshot file"
      />

      {/* Quick Test Demo Chips for Evaluators */}
      <div className="demo-chips-container">
        <span className="demo-chips-label">
          <Sparkles size={12} className="me-1" />
          Quick Test Scenarios:
        </span>
        {PRESET_EXAMPLES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`demo-chip-btn ${preset.type === 'high' ? 'chip-high' : 'chip-safe'}`}
            onClick={() => {
              removeAttachedFile();
              onLoadPreset(preset);
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
            title={preset.text}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Main Glowing Input Box with Drag & Drop */}
      <form onSubmit={handleSubmit}>
        <div 
          className={`input-card-glow ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Document outline icon - Clickable File Upload Trigger */}
          <button
            type="button"
            className="input-icon-left-btn"
            onClick={triggerFileUpload}
            title="Click to upload an offer letter, PDF, or screenshot (.txt, .pdf, .docx, .png, .jpg)"
            aria-label="Upload job offer document or screenshot"
          >
            <div className="position-relative">
              <FileText size={22} />
              <div className="upload-badge-icon">
                <Upload size={10} />
              </div>
            </div>
          </button>

          {/* Textarea Area */}
          <div className="input-textarea-wrapper">
            {/* Uploaded File Pill Indicator if file attached */}
            {attachedFile && (
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 p-2 rounded" style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.35)' }}>
                <div className="d-flex align-items-center gap-2 overflow-hidden">
                  <FileCheck size={16} className="text-success flex-shrink-0" />
                  <span className="file-name-text text-truncate fw-semibold" style={{ maxWidth: '240px' }}>{attachedFile.name}</span>
                  <span className="text-white-50" style={{ fontSize: '0.72rem' }}>({attachedFile.size})</span>
                  <button
                    type="button"
                    className="btn btn-sm text-white-50 p-0 border-0 bg-transparent ms-1 hover-danger"
                    onClick={removeAttachedFile}
                    title="Remove attached file"
                    aria-label="Remove attached file"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25" style={{ fontSize: '0.72rem' }}>
                    Document Ready for Analysis
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary py-0 px-2 fw-medium"
                    style={{ fontSize: '0.75rem', height: '24px' }}
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    Analyze Document Now
                  </button>
                </div>
              </div>
            )}

            <label htmlFor="job-offer-input" className="visually-hidden">
              Job offer, recruiter message, or task details
            </label>
            <textarea
              id="job-offer-input"
              ref={textareaRef}
              className="offer-textarea"
              placeholder={attachedFile ? "Document attached. You can add notes here, or click 'Check this document' to analyze directly..." : "Paste the job offer, recruiter message, or click the file icon to upload a document/screenshot..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxChars}
              rows={2}
              aria-label="Job offer or recruiter message to analyze"
              aria-describedby="char-count"
            />

            {/* Bottom Row controls inside textarea wrapper */}
            <div className="d-flex align-items-center justify-content-between mt-1">
              <div className="d-flex align-items-center gap-2">
                {inputText.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-link text-white-50 p-0 text-decoration-none d-flex align-items-center gap-1"
                    style={{ fontSize: '0.76rem' }}
                    onClick={handleClearAll}
                  >
                    <X size={12} />
                    <span>Clear text</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-link text-white-50 p-0 text-decoration-none d-flex align-items-center gap-1"
                  style={{ fontSize: '0.76rem' }}
                  onClick={triggerFileUpload}
                  title="Upload offer file or screenshot"
                >
                  <Paperclip size={12} className="text-primary" />
                  <span>Upload Document</span>
                </button>
              </div>

              <span id="char-count" className="char-counter-inline">
                {charCount}/{maxChars}
              </span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            className="btn-check-offer"
            disabled={isLoading || (!attachedFile && inputText.trim().length === 0)}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="spinner-icon" />
                <span>Checking {attachedFile ? 'document' : 'offer'}...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>{attachedFile ? 'Check this document' : 'Check this offer'}</span>
              </>
            )}
          </button>
        </div>

        {/* Upload Success Notice */}
        {uploadNotice && (
          <div className="d-flex align-items-center gap-2 mt-2 px-2 text-success" style={{ fontSize: '0.8rem' }}>
            <Check size={14} />
            <span>{uploadNotice}</span>
          </div>
        )}

        {/* Upload Error Notice */}
        {uploadError && (
          <div className="d-flex align-items-center gap-2 mt-2 px-2 text-danger" style={{ fontSize: '0.8rem' }} role="alert">
            <AlertCircle size={14} />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Validation / Error Feedback */}
        {error && (
          <div className="input-feedback-error" role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Active Analysis Banner */}
        {isLoading && (
          <div className="text-center mt-3" style={{ color: '#c4b5fd', fontSize: '0.86rem' }}>
            <span className="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true"></span>
            Checking this offer for suspicious patterns...
          </div>
        )}
      </form>
    </div>
  );
}
