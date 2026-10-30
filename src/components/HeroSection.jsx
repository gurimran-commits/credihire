import React from 'react';
import { Sparkles, MessageSquare, Users, Briefcase, FileText } from 'lucide-react';

export function HeroSection({ onUploadClick }) {
  return (
    <section className="hero-section" id="home">
      {/* Decorative Orbit Arc & Floating Badges */}
      <div className="orbit-wrapper">
        <div className="orbit-line" aria-hidden="true"></div>
        
        {/* Top-left: Chat bubble badge */}
        <div className="orbit-badge top-left" aria-hidden="true" title="Instant messaging scams">
          <MessageSquare size={22} />
        </div>

        {/* Bottom-left: Users group badge */}
        <div className="orbit-badge bottom-left" aria-hidden="true" title="Recruiter impersonation">
          <Users size={22} />
        </div>

        {/* Top-right: Briefcase badge */}
        <div className="orbit-badge top-right" aria-hidden="true" title="Fake job offers">
          <Briefcase size={22} />
        </div>

        {/* Bottom-right: Document badge (Clickable to trigger upload) */}
        <button 
          type="button"
          className="orbit-badge bottom-right border-0" 
          title="Click to upload offer document or screenshot"
          onClick={onUploadClick}
          aria-label="Upload job offer document or screenshot"
          style={{ cursor: 'pointer' }}
        >
          <FileText size={22} />
        </button>
      </div>

      <div className="container position-relative" style={{ zIndex: 10 }}>
        {/* Pill Badge */}
        <div>
          <div className="hero-badge-pill">
            <Sparkles size={14} className="text-purple" />
            <span>AI-Powered Job Scam Detection</span>
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="hero-heading">
          <span className="heading-white">A job offer </span>
          <span className="heading-gradient">worth checking.</span>
        </h1>

        {/* Supporting Subtitle */}
        <p className="hero-subtitle">
          Spot fake jobs, payment traps, and recruiter impersonation before you lose money.
        </p>
      </div>
    </section>
  );
}
