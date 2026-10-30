import React from 'react';
import { ShieldCheck, ExternalLink, Phone } from 'lucide-react';

export function RecommendedActions({ recommendations = [] }) {
  const steps = recommendations;

  return (
    <div>
      <div className="column-header-title">
        <ShieldCheck size={20} className="text-primary" />
        <span>What You Should Do</span>
      </div>

      <div className="actions-steps-list">
        {steps.length === 0 && <p className="text-white-50 mb-0">No specific recommendations were returned.</p>}
        {steps.map((item, idx) => {
          const stepNum = item.step || idx + 1;
          return (
            <div key={idx} className="action-step-item">
              <div className="action-step-number" aria-hidden="true">
                {stepNum}
              </div>

              <div className="action-step-content">
                <div className="action-step-title">{item.title}</div>
                <div className="action-step-desc">
                  {item.links && item.links.length > 0 ? (
                    <span>
                      {item.description && item.description.includes('National Cybercrime') ? (
                        <span>
                          Share screenshots on the{' '}
                          <a
                            href="https://cybercrime.gov.in/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-link-external"
                          >
                            <span>National Cybercrime Portal</span>
                            <ExternalLink size={12} />
                          </a>
                          {' '}or{' '}
                          <a
                            href="tel:1930"
                            className="action-link-external"
                          >
                            <span>helpline 1930</span>
                            <ExternalLink size={12} />
                          </a>
                        </span>
                      ) : (
                        <span>
                          {item.description}{' '}
                          {item.links.map((link, lIdx) => (
                            <a
                              key={lIdx}
                              href={link.url}
                              target={link.url.startsWith('http') ? '_blank' : undefined}
                              rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                              className="action-link-external me-2"
                            >
                              <span>{link.label}</span>
                              <ExternalLink size={12} />
                            </a>
                          ))}
                        </span>
                      )}
                    </span>
                  ) : (
                    item.description
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
