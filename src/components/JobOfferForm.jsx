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
  Check,
  Globe,
  Link2
} from 'lucide-react';
import { PRESET_EXAMPLES, PRESET_URL_EXAMPLES } from '../data/demoAnalysis.js';
import { MAX_INPUT_CHARS, MAX_URL_CHARS, validateUploadFile } from '../utils/validation.js';

export function JobOfferForm({
  inputMode = 'text',
  onModeChange,
  inputText,
  setInputText,
  urlInput = '',
  setUrlInput,
  attachedFile: propAttachedFile,
  setAttachedFile: propSetAttachedFile,
  onSubmit,
  onSubmitUrl,
  isLoading,
  error,
  onClear,
  onLoadPreset,
  onLoadUrlPreset
}) {
  const textareaRef = useRef(null);
  const urlInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [localFile, setLocalFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const attachedFile = propAttachedFile !== undefined ? propAttachedFile : localFile;
  const setAttachedFile = propSetAttachedFile || setLocalFile;

  const charCount = inputText ? inputText.length : 0;
  const maxChars = MAX_INPUT_CHARS;

  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (isLoading) return;

    if (inputMode === 'url') {
      if (onSubmitUrl) {
        onSubmitUrl(urlInput);
      }
    } else {
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
    if (e.target) {
      e.target.value = '';
    }
  };

  const showUploadError = (msg) => {
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 5000);
  };

  const processSelectedFile = (file) => {
    setUploadError(null);
    const validation = validateUploadFile(file);
    if (!validation.isValid) {
      showUploadError(validation.error);
      return;
    }
    setAttachedFile(file);
    setInputText('');
    showUploadSuccess(`Document ${file.name} is ready to upload for analysis.`);
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
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        aria-label="Upload offer letter or screenshot file"
      />

      {/* Mode Navigation Tabs */}
      <div className="d-flex align-items-center justify-content-center mb-3">
        <div className="input-mode-toggle-group">
          <button
            type="button"
            className={`input-mode-tab-btn ${inputMode === 'text' ? 'active' : ''}`}
            onClick={() => onModeChange && onModeChange('text')}
          >
            <FileText size={15} />
            <span>Job Offer / Document</span>
          </button>
          <button
            type="button"
            className={`input-mode-tab-btn ${inputMode === 'url' ? 'active' : ''}`}
            onClick={() => onModeChange && onModeChange('url')}
          >
            <Globe size={15} />
            <span>Website URL Checker</span>
          </button>
        </div>
      </div>

      {/* Quick Test Demo Chips for Evaluators */}
      {inputMode === 'text' ? (
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
      ) : (
        <div className="demo-chips-container">
          <span className="demo-chips-label">
            <Sparkles size={12} className="me-1" />
            Sample URLs:
          </span>
          {PRESET_URL_EXAMPLES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`demo-chip-btn ${preset.type === 'high' ? 'chip-high' : (preset.type === 'medium' ? 'chip-medium' : 'chip-safe')}`}
              onClick={() => {
                if (onLoadUrlPreset) {
                  onLoadUrlPreset(preset);
                } else if (setUrlInput) {
                  setUrlInput(preset.url);
                }
                if (urlInputRef.current) {
                  urlInputRef.current.focus();
                }
              }}
              title={preset.url}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Glowing Input Box */}
      <form onSubmit={handleSubmit}>
        {inputMode === 'text' ? (
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
              title="Upload a PDF or screenshot (.pdf, .png, .jpg, .jpeg)"
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
              {attachedFile && (
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 p-2 rounded" style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.35)' }}>
                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                    <FileCheck size={16} className="text-success flex-shrink-0" />
                    <span className="file-name-text text-truncate fw-semibold" style={{ maxWidth: '240px' }}>{attachedFile.name}</span>
                    <span className="text-white-50" style={{ fontSize: '0.72rem' }}>({(attachedFile.size / 1024).toFixed(1)} KB)</span>
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
                placeholder={attachedFile ? "Document attached. Click â€˜Check this documentâ€™ to upload it for analysis." : "Paste the job offer, recruiter message, or click the file icon to upload a document/screenshot..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={maxChars}
                rows={2}
                aria-label="Job offer or recruiter message to analyze"
                aria-describedby="char-count"
              />

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
        ) : (
          <div className="input-card-glow">
            <div className="input-icon-left-btn pe-none">
              <Globe size={22} className="text-primary" />
            </div>

            <div className="input-textarea-wrapper">
              <label htmlFor="url-credibility-input" className="visually-hidden">
                Recruitment Website URL
              </label>
              <input
                id="url-credibility-input"
                ref={urlInputRef}
                type="text"
                className="offer-textarea py-2"
                style={{ resize: 'none', height: '44px' }}
                placeholder="Paste recruitment website URL (e.g. https://careers.company.com or company-jobs.xyz)..."
                value={urlInput}
                onChange={(e) => setUrlInput && setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                maxLength={MAX_URL_CHARS}
                aria-label="Recruitment website URL to analyze"
              />

              <div className="d-flex align-items-center justify-content-between mt-1">
                <div className="d-flex align-items-center gap-2">
                  {urlInput.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-link text-white-50 p-0 text-decoration-none d-flex align-items-center gap-1"
                      style={{ fontSize: '0.76rem' }}
                      onClick={() => setUrlInput && setUrlInput('')}
                    >
                      <X size={12} />
                      <span>Clear URL</span>
                    </button>
                  )}
                  <span className="text-white-50" style={{ fontSize: '0.74rem' }}>
                    <Link2 size={11} className="me-1" />
                    Checks domain syntax, SSRF-safe redirects, and TLS certificates
                  </span>
                </div>

                <span className="char-counter-inline">
                  {urlInput.length}/{MAX_URL_CHARS}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="btn-check-offer"
              disabled={isLoading || urlInput.trim().length === 0}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="spinner-icon" />
                  <span>Inspecting URL...</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                  <span>Check website URL</span>
                </>
              )}
            </button>
          </div>
        )}

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
            {inputMode === 'url' ? 'Analyzing recruitment URL credibility and transport security...' : 'Checking this offer for suspicious patterns...'}
          </div>
        )}
      </form>
    </div>
  );
}
