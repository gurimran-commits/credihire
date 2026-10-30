import React from 'react';
import { Info } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto">
      <div className="safety-disclaimer-bar">
        <Info size={16} className="text-secondary" />
        <span>© 2026 CrediHire. Helping you spot job scams and make safer career decisions. Stay alert. Stay protected. </span>
      </div>
    </footer>
  );
}
