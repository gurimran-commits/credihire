import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Loader2, RotateCcw, Send, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react';
import { ChatApiError, createSessionId, sendChatMessage } from '../services/chatService.js';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  reply: 'Hi, I am Credihire AI Assistant. Ask about job-scam warning signs or discuss a suspicious message.'
};
const SUGGESTIONS = [
  'What are common job-scam warning signs?',
  'Should I pay a registration fee for a job?',
  'How can I verify a recruiter?'
];

function AnalysisCard({ analysis }) {
  if (!analysis) return null;
  return (
    <section className="chat-analysis-card" aria-label="Scam analysis result">
      <div className="chat-analysis-heading"><ShieldAlert size={15} /> Deterministic scam analysis</div>
      <div className="chat-analysis-summary">
        {analysis.risk_score != null && <span>Risk score: <strong>{analysis.risk_score}</strong></span>}
        {analysis.risk_level && <span>Level: <strong>{analysis.risk_level}</strong></span>}
        {analysis.scam_stage && <span>Stage: <strong>{analysis.scam_stage}</strong></span>}
      </div>
      {analysis.indicators?.length > 0 && <div><strong>Indicators</strong><ul>{analysis.indicators.map((item, index) => <li key={`${item.code || 'indicator'}-${index}`}>{item.message || item.code}</li>)}</ul></div>}
      {analysis.evidence?.length > 0 && <div><strong>Evidence</strong><ul>{analysis.evidence.map((item, index) => <li key={`${item.indicator_code || 'evidence'}-${index}`}>{item.detail}</li>)}</ul></div>}
      {analysis.recommendations?.length > 0 && <div><strong>Recommendations</strong><ul>{analysis.recommendations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
    </section>
  );
}

export function Chatbot({ analysisId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState(createSessionId);
  const [analyzeMessage, setAnalyzeMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRequest, setLastRequest] = useState(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isLoading]);

  const submitMessage = async (message, retry = false) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) {
      if (!trimmed) setError('Please enter a message.');
      return;
    }
    const request = retry ? lastRequest : { message: trimmed, analyzeMessage, analysisId };
    if (!request) return;
    setError('');
    if (!retry) {
      setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', reply: trimmed }]);
      setDraft('');
      setLastRequest(request);
    }
    setIsLoading(true);
    try {
      const response = await sendChatMessage({ ...request, sessionId }, undefined);
      setSessionId(response.session_id);
      setMessages((current) => [...current, {
        id: response.message_id,
        role: 'assistant',
        reply: response.reply,
        disclaimer: response.disclaimer,
        analysis: response.analysis
      }]);
      setLastRequest(null);
    } catch (caughtError) {
      setError(caughtError instanceof ChatApiError ? caughtError.message : 'Chat could not respond. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([WELCOME_MESSAGE]);
    setSessionId(createSessionId());
    setDraft('');
    setError('');
    setLastRequest(null);
  };

  return (
    <div className="credihire-chatbot">
      {isOpen && (
        <section className="chatbot-panel" role="dialog" aria-label="Credihire AI Assistant">
          <header className="chatbot-header">
            <div className="d-flex align-items-center gap-2"><Bot size={19} /><div><strong>Credihire AI Assistant</strong><small>Scam-awareness guidance</small></div></div>
            <div className="d-flex gap-1"><button type="button" className="chatbot-icon-button" onClick={clearConversation} aria-label="Clear conversation" title="Clear conversation"><Trash2 size={16} /></button><button type="button" className="chatbot-icon-button" onClick={() => setIsOpen(false)} aria-label="Close assistant"><X size={18} /></button></div>
          </header>
          <div className="chatbot-messages" ref={messagesRef} aria-live="polite">
            {messages.map((item) => (
              <div className={`chat-message ${item.role}`} key={item.id}>
                <div className="chat-message-bubble">{item.reply}</div>
                {item.analysis && <AnalysisCard analysis={item.analysis} />}
                {item.disclaimer && <small className="chat-disclaimer">{item.disclaimer}</small>}
              </div>
            ))}
            {messages.length === 1 && <div className="chat-suggestions">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => submitMessage(suggestion)}>{suggestion}</button>)}</div>}
            {isLoading && <div className="chat-message assistant"><div className="chat-message-bubble chat-loading"><Loader2 size={16} className="spin" /> Thinking…</div></div>}
          </div>
          {error && <div className="chat-error" role="alert"><AlertCircle size={16} /><span>{error}</span>{lastRequest && <button type="button" onClick={() => submitMessage(lastRequest.message, true)} disabled={isLoading}><RotateCcw size={14} /> Retry</button>}</div>}
          <form className="chatbot-composer" onSubmit={(event) => { event.preventDefault(); submitMessage(draft); }}>
            <label className="chat-analysis-toggle"><input type="checkbox" checked={analyzeMessage} onChange={(event) => setAnalyzeMessage(event.target.checked)} /> Analyze my message for scam indicators</label>
            <div className="chat-input-row"><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(draft); } }} placeholder="Ask about a suspicious job message…" maxLength={4000} aria-label="Message Credihire AI Assistant" rows={2} disabled={isLoading} /><button type="submit" className="chat-send-button" aria-label="Send message" disabled={isLoading || !draft.trim()}><Send size={17} /></button></div>
          </form>
        </section>
      )}
      <button type="button" className="chatbot-launcher" onClick={() => setIsOpen((current) => !current)} aria-label={isOpen ? 'Close Credihire AI Assistant' : 'Open Credihire AI Assistant'} aria-expanded={isOpen}><Sparkles size={20} /><span>AI Assistant</span></button>
    </div>
  );
}
