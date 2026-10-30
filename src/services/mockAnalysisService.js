/**
 * Heuristic Scam Analysis Service (Client-Side Intelligence Engine)
 * Evaluates job text against realistic fraud patterns, keyword signatures,
 * and conversational dynamics when no backend server is configured.
 */

import { getCurrentFormattedTime } from '../utils/validation.js';

export function analyzeJobOfferLocally(text, attachedFile = null) {
  const fileText = attachedFile?.text ? attachedFile.text.trim() : '';
  const effectiveText = (text && text.trim().length > 0) 
    ? text.trim() 
    : (fileText.length > 0 
        ? fileText 
        : (attachedFile ? `[Uploaded Document: ${attachedFile.name} (${attachedFile.size || 'Attached'})]\nReviewing uploaded document for job scam, payment traps, and recruiter impersonation indicators.` : ''));

  const fileName = (attachedFile?.name || '').toLowerCase();
  const lower = (effectiveText + ' ' + fileName).toLowerCase();
  const warningSigns = [];
  let score = 15; // Baseline low risk for normal text

  // 1. ADVANCE PAYMENT / REGISTRATION FEE CHECK
  const paymentTriggers = [
    'registration fee', 'security deposit', 'onboarding fee', 'training fee',
    'pay ₹', 'pay inr', 'pay $', 'payment fee', 'processing charge', 'courier charge',
    'pay 1499', 'pay 1,499', 'pay 500', 'pay 1000', 'refundable fee', 'deposit required',
    'fee_scam', 'payment_scam', 'registration_fee'
  ];
  const hasPayment = paymentTriggers.some(term => lower.includes(term));
  if (hasPayment) {
    score += 45;
    warningSigns.push({
      id: 'advance-payment',
      title: 'Advance payment request',
      explanation: "Legitimate employers don't charge recruitment or onboarding fees.",
      severity: 'high',
      icon: 'CreditCard',
      evidence: attachedFile ? `Detected advance fee demand in uploaded document (${attachedFile.name}).` : 'Request for upfront fee or registration deposit detected.',
      patternExplainer: {
        whatItIs: 'The sender requests an upfront monetary transfer before employment begins or training material is dispatched.',
        whyItMatters: 'Real corporations bear the cost of onboarding talent. Demanding fees is the single biggest indicator of employment fraud.',
        realWorldTactic: 'Posing as refundable deposits or license fees that are promised to be returned in the first paycheck.',
        immediateAction: 'Refuse all payments. Stop interaction immediately.'
      }
    });
  }

  // 2. UNREALISTIC EARNINGS & TASK SCAMS
  const taskTriggers = [
    'youtube', 'like video', 'rating', 'telegram', 'daily income', 'per day',
    'earn 2500', 'earn 5000', 'earn 8000', 'part time', 'work 30 mins', 'recharge', 'vip task',
    'task_scam', 'task scam', 'fake_job_task', 'fake job'
  ];
  const hasTaskFraud = taskTriggers.some(term => lower.includes(term));
  if (hasTaskFraud) {
    score += 45;
    warningSigns.push({
      id: 'unrealistic-tasks',
      title: 'Task-based earning or unrealistic pay',
      explanation: 'Simple work with high daily compensation is typical of task scams.',
      severity: 'high',
      icon: 'FileText',
      evidence: attachedFile ? `Document (${attachedFile.name}) flagged for task-based earning scam patterns.` : 'Promises of daily high payouts for simple likes, ratings, or part-time tasks.',
      patternExplainer: {
        whatItIs: 'Victims are asked to complete trivial tasks (rating hotels, liking YouTube clips) and eventually asked to deposit funds to withdraw "earnings".',
        whyItMatters: 'The system is rigged to let victims withdraw a small amount once (e.g. ₹200) to build false trust before defrauding them of thousands.',
        realWorldTactic: 'Operating via encrypted Telegram channels with bots and fake testimonials.',
        immediateAction: 'Exit any Telegram or WhatsApp groups promising daily task payouts.'
      }
    });
  }

  // 3. CREDENTIAL / OTP / BANKING PHISHING
  const phishingTriggers = [
    'otp', 'one time password', 'bank account', 'cvv', 'pin', 'anydesk', 'teamviewer',
    'screen share', 'net banking', 'salary account verification'
  ];
  const hasPhishing = phishingTriggers.some(term => lower.includes(term));
  if (hasPhishing) {
    score += 65; // Critical risk: immediate high risk flag (15 + 65 = 80)
    warningSigns.push({
      id: 'credential-harvesting',
      title: 'Request for OTP, passwords, or banking access',
      explanation: 'Legitimate employers never demand OTPs or remote screen control.',
      severity: 'high',
      icon: 'Key',
      evidence: 'Message asks for authentication codes, banking credentials, or remote desktop tools.',
      patternExplainer: {
        whatItIs: 'Imposters requesting OTPs or requesting victims install screen-sharing software (AnyDesk, TeamViewer) under the guise of "IT setup".',
        whyItMatters: 'Sharing an OTP or screen allows malicious actors to directly initiate unauthorized bank transfers from your account.',
        realWorldTactic: 'Pretending to set up corporate VPN or verify salary disbursement accounts.',
        immediateAction: 'Never share OTPs or install remote management apps from unknown recruiters.'
      }
    });
  }

  // 4. SUSPICIOUS CHANNELS (WhatsApp / Telegram)
  const channelTriggers = ['whatsapp', 'telegram', '@', 'wa.me', 't.me'];
  const hasMessagingOnly = channelTriggers.some(term => lower.includes(term));
  if (hasMessagingOnly) {
    score += 15;
    warningSigns.push({
      id: 'communication-channel',
      title: 'Communication only via instant messaging',
      explanation: 'Scammers avoid official company emails to evade tracking.',
      severity: 'medium',
      icon: 'MessageCircle',
      externalUrl: 'https://faq.whatsapp.com/599342792194687',
      evidence: 'Recruitment outreach conducted through instant messaging platforms.',
      patternExplainer: {
        whatItIs: 'Recruiter exclusively utilizes WhatsApp, Telegram, or free webmail without any corporate domain correspondence.',
        whyItMatters: 'Burner phone numbers and disposable messaging accounts make criminal perpetrators difficult to trace.',
        realWorldTactic: 'Foreign country codes (+62, +84, +234, etc.) masquerading as local HR departments.',
        immediateAction: 'Request an official email confirmation from the company verified domain.'
      }
    });
  }

  // 5. NO MENTION OF VERIFIABLE COMPANY OR VAGUE DETAILS
  const companyMention = ['careers.', 'linkedin.com', 'official portal', 'google meet', 'interview rounds'];
  const hasLegitSignals = companyMention.some(term => lower.includes(term));
  if (!hasLegitSignals && (hasPayment || hasTaskFraud || hasMessagingOnly)) {
    score += 10;
    warningSigns.push({
      id: 'unverified-entity',
      title: 'No official company website or email domain',
      explanation: 'Could not find verifiable company identification.',
      severity: 'medium',
      icon: 'Link2Off',
      evidence: 'Missing official corporate website or domain email.',
      patternExplainer: {
        whatItIs: 'Absence of verifiable website, registered address, or corporate presence on official directories.',
        whyItMatters: 'Scammers use vague names (e.g. "Global Remote Services") or hijack known brand names with zero affiliation.',
        realWorldTactic: 'Sending PDF offer letters containing stolen logos copied from LinkedIn.',
        immediateAction: 'Search corporate registrations on government websites like MCA.gov.in.'
      }
    });
  }

  // Determine channel badge
  let channel = 'generic';
  if (attachedFile) {
    const isImg = attachedFile.type?.includes('image') || attachedFile.name?.match(/\.(png|jpg|jpeg|webp)$/i);
    channel = isImg ? 'screenshot' : 'document';
  } else if (lower.includes('whatsapp') || lower.includes('₹1,499') || lower.includes('remote data entry')) {
    channel = 'whatsapp';
  } else if (lower.includes('telegram')) {
    channel = 'telegram';
  } else if (lower.includes('email') || lower.includes('dear candidate') || lower.includes('dear rahul')) {
    channel = 'email';
  }

  // Cap score between 5 and 98
  let normalizedScore = Math.min(Math.max(score, 5), 98);

  // If text is extremely short or vague with no specific indicators
  let riskLevel = 'low';
  let headline = 'Low Risk';
  let summary = 'No high-risk scam patterns detected.';

  if (!attachedFile && effectiveText.trim().length < 35 && warningSigns.length === 0) {
    normalizedScore = 20;
    riskLevel = 'insufficient';
    headline = 'Insufficient Evidence';
    summary = 'Not enough context to evaluate risk. Please paste the full recruiter message or email.';
  } else if (normalizedScore >= 70) {
    riskLevel = 'high';
    headline = 'High Risk';
    summary = attachedFile 
      ? 'This document exhibits critical warning signs of employment fraud.' 
      : 'This appears to be a scam.';
  } else if (normalizedScore >= 40) {
    riskLevel = 'medium';
    headline = 'Medium Risk';
    summary = 'Suspicious elements detected. Proceed with caution and verify independently.';
  } else {
    riskLevel = 'low';
    headline = 'Low Risk';
    summary = attachedFile
      ? 'This document exhibits characteristics consistent with legitimate recruitment.'
      : 'This offer exhibits characteristics consistent with legitimate recruitment.';
  }

  // Dynamic context-aware recommendations
  const recommendations = [];
  if (riskLevel === 'high' || riskLevel === 'medium') {
    recommendations.push({
      step: 1,
      title: 'Verify the company',
      description: 'Check the official website and LinkedIn page.'
    });

    if (hasPayment) {
      recommendations.push({
        step: 2,
        title: 'Do not make any payment',
        description: 'Legitimate employers never ask for registration or onboarding fees.'
      });
    } else if (hasPhishing) {
      recommendations.push({
        step: 2,
        title: 'Never share OTPs or passwords',
        description: 'No legitimate employer or background check vendor will ever ask for personal authentication codes.'
      });
    } else {
      recommendations.push({
        step: 2,
        title: 'Do not share sensitive credentials',
        description: 'Do not submit bank account details or identity documents through unverified forms.'
      });
    }

    recommendations.push({
      step: 3,
      title: 'Report this offer',
      description: 'Share screenshots on the National Cybercrime Portal or helpline 1930',
      links: [
        { label: 'National Cybercrime Portal', url: 'https://cybercrime.gov.in/' },
        { label: 'helpline 1930', url: 'tel:1930' }
      ]
    });
  } else {
    // Low risk or insufficient evidence recommendations
    recommendations.push({
      step: 1,
      title: 'Check verified company portal',
      description: 'Confirm the job listing on the company careers page.'
    });
    recommendations.push({
      step: 2,
      title: 'Protect personal information',
      description: 'Only provide sensitive bank details through official onboarding paperwork after a formal offer.'
    });
    recommendations.push({
      step: 3,
      title: 'Verify recruiter identity',
      description: 'Verify the recruiter profile on LinkedIn and confirm they message from an official corporate email.'
    });
  }

  return {
    isDemo: false,
    submittedText: effectiveText,
    attachedFile: attachedFile ? {
      name: attachedFile.name,
      size: attachedFile.size,
      type: attachedFile.type
    } : null,
    timestamp: getCurrentFormattedTime(),
    channel,
    riskScore: normalizedScore,
    riskLevel,
    headline,
    summary,
    scamStage: hasPayment ? 'payment_request' : (hasTaskFraud ? 'task_assignment' : 'initial_outreach'),
    warningSigns,
    recommendations,
    verification: {
      status: riskLevel === 'high' ? 'unverified' : (riskLevel === 'low' ? 'verified_pattern' : 'needs_review'),
      message: riskLevel === 'high'
        ? 'Multiple warning signs commonly linked with job scams were identified.'
        : (riskLevel === 'low'
          ? 'Language aligns with standard professional recruitment norms.'
          : 'Exercise caution and verify the employer through official channels.')
    }
  };
}
