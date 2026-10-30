/**
 * Demo and reference datasets for CrediHire
 * Provides the exact initial reference demonstration matching the visual specification,
 * as well as realistic test scenarios for hackathon evaluation.
 */

export const INITIAL_DEMO_DATA = {
  isDemo: true,
  submittedText: "Hi! You've been selected for a remote data entry position. To complete your onboarding, please pay ₹1,499 as a registration fee. You'll receive the work details after payment.",
  timestamp: "2:14 PM",
  channel: "whatsapp",
  riskScore: 85,
  riskLevel: "high", // 'high' | 'medium' | 'low' | 'insufficient'
  headline: "High Risk",
  summary: "This appears to be a scam.",
  scamStage: "payment_request",
  warningSigns: [
    {
      id: "advance-payment",
      title: "Advance payment request",
      explanation: "Legitimate employers don't charge fees.",
      severity: "high",
      icon: "CreditCard",
      evidence: "please pay ₹1,499 as a registration fee",
      patternExplainer: {
        whatItIs: "The recruiter requests candidates to pay an upfront fee for registration, training, ID kit, or background checks.",
        whyItMatters: "Legitimate employers never demand payment from applicants to get hired. In almost all jurisdictions, charging candidates recruitment fees is considered predatory fraud.",
        realWorldTactic: "Often framed as a 'refundable security deposit' or 'portal access fee'. Once you pay, scammers ask for more money or ghost you.",
        immediateAction: "Never send money to an employer. Stop all communication immediately."
      }
    },
    {
      id: "unrealistic-job",
      title: "Unrealistic job description",
      explanation: "Simple work with high pay is a common scam.",
      severity: "high",
      icon: "FileText",
      evidence: "selected for a remote data entry position with upfront payment",
      patternExplainer: {
        whatItIs: "Offers promising handsome earnings for minimal skill, such as copying text, rating videos, or captcha filling.",
        whyItMatters: "Scammers use lucrative promises as psychological bait to lower victims' critical skepticism.",
        realWorldTactic: "Pretends to offer guaranteed part-time flexibility so students, homemakers, and job seekers let their guard down.",
        immediateAction: "Compare salary offers with verified industry benchmarks on Glassdoor, AmbitionBox, or official job boards."
      }
    },
    {
      id: "no-official-website",
      title: "No official company website",
      explanation: "Could not find a verified company online.",
      severity: "medium",
      icon: "Link2Off",
      evidence: "Missing company domain or authentic credentials",
      patternExplainer: {
        whatItIs: "Recruiter communicates without specifying a verifiable company URL, official corporate email, or physical address.",
        whyItMatters: "Fraudulent operators conceal their identities by operating behind ephemeral handles and free messaging apps.",
        realWorldTactic: "Using free webmail (gmail/yahoo) or clone websites registered only days prior on whois databases.",
        immediateAction: "Look up the company on official government corporate registries (like MCA.gov.in) and verify the recruiter on LinkedIn."
      }
    },
    {
      id: "whatsapp-only",
      title: "Communication only via WhatsApp",
      explanation: "Scammers often avoid official channels.",
      severity: "medium",
      icon: "MessageCircle",
      externalUrl: "https://faq.whatsapp.com/599342792194687",
      evidence: "Offer delivered solely via instant messaging",
      patternExplainer: {
        whatItIs: "Conducting an entire hiring lifecycle solely over WhatsApp, Telegram, or SMS without video calls or domain emails.",
        whyItMatters: "End-to-end encrypted messaging allows scammers to quickly delete messages, block victims, and reuse burner SIM cards.",
        realWorldTactic: "Recruiters using overseas numbers (+62, +84, +234, etc.) claiming to be hiring on behalf of multinational firms.",
        immediateAction: "Demand an official offer letter sent from the company's verified corporate domain email."
      }
    }
  ],
  recommendations: [
    {
      step: 1,
      title: "Verify the company",
      description: "Check the official website and LinkedIn page.",
      icon: "ShieldCheck"
    },
    {
      step: 2,
      title: "Do not make any payment",
      description: "Legitimate employers never ask for registration or onboarding fees.",
      icon: "AlertOctagon"
    },
    {
      step: 3,
      title: "Report this offer",
      description: "Share screenshots on the National Cybercrime Portal or helpline 1930",
      icon: "Flag",
      links: [
        { label: "National Cybercrime Portal", url: "https://cybercrime.gov.in/" },
        { label: "helpline 1930", url: "tel:1930" }
      ]
    }
  ],
  verification: {
    status: "unverified",
    message: "The company identity and recruitment process have not been independently verified."
  }
};

export const PRESET_EXAMPLES = [
  {
    id: "data-entry-fee",
    label: "Remote Data Entry Fee Scam (Reference)",
    type: "high",
    text: "Hi! You've been selected for a remote data entry position. To complete your onboarding, please pay ₹1,499 as a registration fee. You'll receive the work details after payment."
  },
  {
    id: "telegram-task",
    label: "Telegram 'Like & Earn' Task Fraud",
    type: "high",
    text: "Dear candidate, congratulations! Your resume has been shortlisted for part-time YouTube Video Rating. Earn ₹2,500 to ₹8,000 daily working 30 mins from home. Join our Telegram channel @DailyTaskEarners now. First 3 tasks free, then deposit ₹2,000 in trading wallet to unlock VIP payouts."
  },
  {
    id: "otp-banking",
    label: "HR Impersonation & OTP Harvest",
    type: "high",
    text: "Greetings from Amazon Talent Acquisition. We are reviewing your salary account verification for the Associate role. Please share your bank account number and the 6-digit OTP received on your mobile phone to complete background clearance."
  },
  {
    id: "legit-offer",
    label: "Verified Corporate Interview Invitation",
    type: "low",
    text: "Dear Rahul, Thank you for applying for the Frontend Engineer position at Acme Corp. We would like to invite you for a 45-minute technical interview via Google Meet. Please review the role description on our official portal (careers.acme.com) and confirm your availability for next Tuesday. No fees or bank information are ever required."
  }
];

export const PRESET_URL_EXAMPLES = [
  {
    id: "google-careers",
    label: "Google Careers (Verified Brand)",
    type: "safe",
    url: "https://careers.google.com"
  },
  {
    id: "brand-spoof",
    label: "Amazon Spoof Portal (.xyz)",
    type: "high",
    url: "https://amazon-recruitment-portal.xyz/apply"
  },
  {
    id: "url-shortener",
    label: "Shortened Portal Link (bit.ly)",
    type: "medium",
    url: "https://bit.ly/recruitment-offer-39x"
  },
  {
    id: "insecure-http",
    label: "Unencrypted HTTP Site",
    type: "medium",
    url: "http://recruitment-hiring-desk.net"
  }
];
