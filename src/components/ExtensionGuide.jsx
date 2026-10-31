import React from 'react';
import {
  Puzzle,
  Download,
  X,
  Shield,
  CheckCircle2,
  ExternalLink,
  Chrome,
  Globe,
  Pin,
  MousePointer,
  Sparkles,
  FileCheck,
  AlertTriangle,
  FolderArchive,
  Layers
} from 'lucide-react';

export function ExtensionGuide({ isOpen, onClose }) {
  if (!isOpen) return null;

  const downloadUrl = '/downloads/credihire-extension.zip';

  const benefits = [
    {
      icon: <FileCheck size={18} className="text-teal" />,
      title: "Scan Suspicious Job Offers",
      desc: "Paste WhatsApp, Telegram, email, or SMS job offers into the popup for immediate risk scoring and indicator breakdown."
    },
    {
      icon: <MousePointer size={18} className="text-teal" />,
      title: "Right-Click Context Menu",
      desc: "Highlight any text on LinkedIn, Indeed, Naukri, or job portals, right-click, and select 'Analyze with Credihire'."
    },
    {
      icon: <Globe size={18} className="text-teal" />,
      title: "Recruiter URL & Domain Analysis",
      desc: "Check recruitment portals, free web hosting URLs, and suspicious shortlinks to verify company legitimacy and SSL age."
    },
    {
      icon: <Shield size={18} className="text-teal" />,
      title: "Evidence Grounding & Highlighting",
      desc: "Verifies extracted quotes against original job text to prevent false positives and show exact red flags."
    },
    {
      icon: <Layers size={18} className="text-teal" />,
      title: "Connects to Credihire Backend",
      desc: "Integrates seamlessly with the Credihire AI backend engine, supporting custom backend URLs and offline fallback."
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Download the ZIP package",
      detail: "Click the download button above to save credihire-extension.zip to your computer."
    },
    {
      number: "2",
      title: "Extract the ZIP to a permanent folder",
      detail: "Unzip the downloaded archive into a folder where you want to keep the extension files."
    },
    {
      number: "3",
      title: "Open your browser extensions page",
      detail: "Open Chrome and go to chrome://extensions/ or open Microsoft Edge and go to edge://extensions/."
    },
    {
      number: "4",
      title: "Enable Developer Mode",
      detail: "Turn on the 'Developer mode' toggle switch in the upper-right corner of the extensions page."
    },
    {
      number: "5",
      title: "Click 'Load unpacked'",
      detail: "Click the 'Load unpacked' button located in the top-left navigation toolbar."
    },
    {
      number: "6",
      title: "Select the extracted extension folder",
      detail: "Browse and select the extracted folder containing manifest.json. Credihire will install immediately."
    },
    {
      number: "7",
      title: "Pin Credihire to your browser toolbar",
      detail: "Click the puzzle icon in your browser toolbar and pin the Credihire shield for instant one-click protection."
    }
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="extension-modal-title">
      <div className="modal-dialog-custom extension-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <div className="extension-icon-badge">
              <Puzzle size={22} className="text-teal" />
            </div>
            <div>
              <h2 id="extension-modal-title" className="modal-title mb-0">Credihire Browser Protection</h2>
              <span className="text-white-50" style={{ fontSize: '0.78rem' }}>Chrome & Microsoft Edge Extension (Manifest V3)</span>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Close extension guide">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body-custom d-flex flex-column gap-4 py-4">
          {/* Hero Banner */}
          <div className="extension-hero-card">
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-teal-subtle text-teal px-2 py-1 rounded-pill" style={{ fontSize: '0.72rem' }}>
                    <Sparkles size={12} className="me-1 d-inline" /> Instant Shield
                  </span>
                  <span className="badge bg-dark text-white-50 border border-secondary px-2 py-1 rounded-pill" style={{ fontSize: '0.72rem' }}>
                    v1.0.0
                  </span>
                </div>
                <h3 className="text-white fw-bold mb-1" style={{ fontSize: '1.25rem' }}>
                  Protect Your Job Hunt Everywhere You Browse
                </h3>
                <p className="text-secondary mb-0" style={{ fontSize: '0.86rem', maxWidth: '480px' }}>
                  Analyze suspicious recruitment messages, scan recruiter URLs, and detect task scams in one click directly from LinkedIn, Indeed, Telegram, and WhatsApp Web.
                </p>
              </div>

              {/* Primary Download CTA */}
              <div className="text-md-end flex-shrink-0">
                <a
                  href={downloadUrl}
                  download="credihire-extension.zip"
                  className="btn-extension-download"
                  title="Download Credihire Extension ZIP for Chrome and Edge"
                >
                  <Download size={18} />
                  <span>Download for Chrome / Edge</span>
                </a>
                <div className="text-white-50 mt-1" style={{ fontSize: '0.74rem' }}>
                  Package ZIP (40 KB) • Manifest V3
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Grid */}
          <div>
            <h4 className="text-white fw-semibold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '1rem' }}>
              <Shield size={18} className="text-teal" />
              <span>What You Get With the Extension</span>
            </h4>
            <div className="row g-2">
              {benefits.map((b, idx) => (
                <div key={idx} className="col-12 col-md-6">
                  <div className="extension-benefit-item h-100">
                    <div className="extension-benefit-icon">
                      {b.icon}
                    </div>
                    <div>
                      <div className="text-white fw-semibold mb-1" style={{ fontSize: '0.88rem' }}>{b.title}</div>
                      <div className="text-secondary" style={{ fontSize: '0.80rem', lineHeight: '1.4' }}>{b.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step Installation */}
          <div>
            <h4 className="text-white fw-semibold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '1rem' }}>
              <FolderArchive size={18} className="text-teal" />
              <span>Step-by-Step Installation Instructions</span>
            </h4>
            <div className="extension-steps-container">
              {steps.map((s, idx) => (
                <div key={idx} className="extension-step-row">
                  <div className="extension-step-number">{s.number}</div>
                  <div className="extension-step-content">
                    <div className="text-white fw-semibold" style={{ fontSize: '0.88rem' }}>{s.title}</div>
                    <div className="text-secondary" style={{ fontSize: '0.82rem' }}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution Notice */}
          <div className="extension-note-card">
            <div className="d-flex align-items-start gap-2">
              <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-1" />
              <div style={{ fontSize: '0.82rem', lineHeight: '1.45' }}>
                <strong className="text-white">Manual Developer Distribution:</strong>{' '}
                <span className="text-white-50">
                  Credihire is currently distributed directly as an open-source unpacked package and has not yet been published on the Chrome Web Store or Microsoft Edge Add-ons store. Loading unpacked extensions in Developer Mode is 100% safe, runs locally, and requires no elevated system permissions.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer-custom d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2 text-white-50" style={{ fontSize: '0.78rem' }}>
            <Chrome size={15} className="text-teal" />
            <span>Chrome & Microsoft Edge Compatible</span>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm px-3" onClick={onClose} style={{ borderRadius: '20px' }}>
              Close
            </button>
            <a
              href={downloadUrl}
              download="credihire-extension.zip"
              className="btn btn-teal-cta btn-sm d-inline-flex align-items-center gap-2 px-3"
              style={{ borderRadius: '20px', textDecoration: 'none' }}
            >
              <Download size={14} />
              <span>Download ZIP</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExtensionGuide;
