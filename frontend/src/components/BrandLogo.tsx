import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
  variant?: 'sidebar' | 'welcome' | 'default';
}

/**
 * BrandLogo: Lenny Growth Assistant brand symbol.
 * 
 * Visual Concept:
 * - 3 ascending waveform bars represent the journey from podcast audio knowledge to insight.
 * - Upper right teal node (#0D9488) represents verified evidence & grounded truth.
 * - Coral peak bar (#FF715B) provides upward growth progression.
 * - High-contrast palette: Navy #152641, Coral #FF715B, Teal #0D9488, Cream #F8F4EA.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 36,
  className = '',
  variant = 'sidebar'
}) => {
  const isLightBg = variant === 'welcome';
  const barColor = isLightBg ? '#152641' : '#F8F4EA';
  const barMutedColor = isLightBg ? 'rgba(21, 38, 65, 0.7)' : 'rgba(248, 244, 234, 0.75)';
  const coralColor = '#FF715B';
  const tealColor = '#0D9488';
  const coreColor = isLightBg ? '#FFFFFF' : '#F8F4EA';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-logo ${className}`}
      aria-label="Lenny Growth Assistant Logo"
      style={{ flexShrink: 0 }}
    >
      {/* Waveform Bar 1: Inception of podcast knowledge */}
      <rect x="4" y="18" width="4" height="12" rx="2" fill={barMutedColor} />
      
      {/* Waveform Bar 2: Deep transcript resonance */}
      <rect x="11" y="12" width="4" height="18" rx="2" fill={barColor} />
      
      {/* Waveform Bar 3: Ascending growth trajectory */}
      <rect x="18" y="6" width="4" height="24" rx="2" fill={coralColor} />
      
      {/* Evidence Node: Grounded proof locus */}
      <circle cx="28" cy="10" r="5" fill={tealColor} />
      <circle cx="28" cy="10" r="2.2" fill={coreColor} />
      
      {/* Action / Metric Anchor: Foundation for execution */}
      <rect x="26" y="19" width="4" height="11" rx="2" fill={tealColor} opacity="0.9" />
    </svg>
  );
};

export default BrandLogo;
