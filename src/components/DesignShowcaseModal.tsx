import React from 'react';
import { X, Check, Sparkles, Palette, Eye, ArrowRight } from 'lucide-react';

export type DesignThemeId = 'desert' | 'botanical' | 'noir' | 'alabaster';

export interface DesignTheme {
  id: DesignThemeId;
  name: string;
  subtitle: string;
  vibe: string;
  palette: {
    bg: string;
    surface: string;
    ink: string;
    accent: string;
    accentName: string;
  };
  typography: string;
  character: string;
  idealFor: string;
}

export const DESIGN_THEMES: DesignTheme[] = [
  {
    id: 'desert',
    name: 'Desert Sanctuary',
    subtitle: 'Signature Dubai Luxury & Linen',
    vibe: 'Timeless, serene, and organic. Resembles an Aman retreat or private desert villa with natural tactile warmth.',
    palette: {
      bg: '#faf8f3',
      surface: '#f2ede4',
      ink: '#0f0e0b',
      accent: '#c4b48a',
      accentName: 'Warm Champagne Sand',
    },
    typography: 'Playfair Display Serif + DM Sans Clean Modern',
    character: 'Warm parchment tones, soft linen textures, and refined champagne gold accents that soothe the eyes.',
    idealFor: 'Intimate boutique practice, holistic mind-body balance, and classic timeless elegance.',
  },
  {
    id: 'botanical',
    name: 'Botanical Zen & Olive Sage',
    subtitle: 'Restorative Earth & Living Greenery',
    vibe: 'Grounded, cellular renewal and natural biophilic calm. Evokes lush morning botanical gardens and tranquil stone pools.',
    palette: {
      bg: '#f4f6f2',
      surface: '#e8ebe4',
      ink: '#1c2621',
      accent: '#4e6b5d',
      accentName: 'Deep Eucalyptus Sage',
    },
    typography: 'Transitional Garamond Serif + Soft Humanist Sans',
    character: 'Muted botanical greens, mineral travertine, and calm moss undertones that reduce cognitive load.',
    idealFor: 'Therapeutic yoga, restorative breathwork, wheel yoga alignment, and stress recovery.',
  },
  {
    id: 'noir',
    name: 'Atelier Noir & Midnight Gold',
    subtitle: 'High-Fashion VIP Sanctuary',
    vibe: 'Exclusive, dramatic, and hypnotic. Resembles an elite private members club in DIFC or a candlelit evening studio.',
    palette: {
      bg: '#0e0e0e',
      surface: '#181818',
      ink: '#f5f5f5',
      accent: '#dfb76c',
      accentName: 'Polished Brass & Gold',
    },
    typography: 'High-Fashion Didone Serif + Razor-Sharp Sans',
    character: 'Deep obsidian black, architectural shadows, and glowing warm gold highlights creating maximum prestige.',
    idealFor: 'High-profile private clientele, evening sessions, luxury personal training, and high sensory focus.',
  },
  {
    id: 'alabaster',
    name: 'Alabaster Daylight & Minimalist',
    subtitle: 'Scandinavian & Tokyo Clean Modernism',
    vibe: 'Luminous, hyper-clean, and breath-oriented. Floor-to-ceiling glass, pale Nordic timber, and pure negative space.',
    palette: {
      bg: '#ffffff',
      surface: '#f8f8f6',
      ink: '#18181b',
      accent: '#968169',
      accentName: 'Raw Travertine Bronze',
    },
    typography: 'Architectural Modern Sans + Minimal Editorial',
    character: 'Stark clarity, crystal-sharp legibility, zero distractions, and open breathing space.',
    idealFor: 'Athletic flow, barre conditioning, postural precision, and modern urban yogis.',
  },
];

interface DesignShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme: DesignThemeId;
  onSelectTheme: (themeId: DesignThemeId) => void;
}

export const DesignShowcaseModal: React.FC<DesignShowcaseModalProps> = ({
  isOpen,
  onClose,
  activeTheme,
  onSelectTheme,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0f0e0b]/80 backdrop-blur-sm">
      <div className="bg-[#faf8f3] text-[#0f0e0b] border border-[#0f0e0b]/15 max-w-4xl w-full p-6 sm:p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto rounded-xs">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 text-[#0f0e0b]/40 hover:text-[#0f0e0b] transition-colors"
          aria-label="Close Design Showcase"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#c4b48a] font-semibold mb-2">
            <Palette className="w-4 h-4" />
            <span>Studio Aesthetic Directions</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#0f0e0b] mb-2">
            Explore 4 Design Options
          </h2>
          <p className="text-sm text-[#0f0e0b]/70 max-w-2xl leading-relaxed">
            Every studio has a unique energy. Click any design option below to instantly preview how the website transforms in real time across the Hero, Schedule, Pricing, and Booking flows.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {DESIGN_THEMES.map((theme) => {
            const isActive = activeTheme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => onSelectTheme(theme.id)}
                className={`p-6 border transition-all cursor-pointer flex flex-col justify-between relative rounded-xs ${
                  isActive
                    ? 'border-[#0f0e0b] bg-[#f2ede4] shadow-md ring-2 ring-[#0f0e0b]/10'
                    : 'border-[#0f0e0b]/15 bg-white/70 hover:border-[#0f0e0b]/40 hover:bg-white'
                }`}
              >
                {isActive && (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 bg-[#0f0e0b] text-[#faf8f3] text-[10px] font-semibold uppercase tracking-wider rounded-xs">
                    <Check className="w-3 h-3 text-[#c4b48a]" /> Active
                  </span>
                )}

                <div>
                  {/* Swatches */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <span
                      className="w-6 h-6 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: theme.palette.bg }}
                      title="Background"
                    />
                    <span
                      className="w-6 h-6 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: theme.palette.surface }}
                      title="Surface"
                    />
                    <span
                      className="w-6 h-6 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: theme.palette.ink }}
                      title="Typography Ink"
                    />
                    <span
                      className="w-6 h-6 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: theme.palette.accent }}
                      title={theme.palette.accentName}
                    />
                    <span className="text-[11px] text-[#0f0e0b]/50 ml-2 font-mono">
                      {theme.palette.accentName}
                    </span>
                  </div>

                  <span className="text-[10px] uppercase tracking-widest text-[#0f0e0b]/50 font-semibold block mb-1">
                    {theme.subtitle}
                  </span>
                  <h3 className="font-serif text-2xl text-[#0f0e0b] mb-2 font-medium">
                    {theme.name}
                  </h3>
                  <p className="text-xs text-[#0f0e0b]/75 leading-relaxed mb-4">
                    {theme.vibe}
                  </p>

                  <div className="space-y-1.5 text-xs text-[#0f0e0b]/70 border-t border-[#0f0e0b]/10 pt-3">
                    <p>
                      <strong className="text-[#0f0e0b]">Typography:</strong> {theme.typography}
                    </p>
                    <p>
                      <strong className="text-[#0f0e0b]">Ideal For:</strong> {theme.idealFor}
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-[#0f0e0b]/10 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#0f0e0b]/70">
                    {isActive ? 'Currently Applied' : 'Click to Apply Theme'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTheme(theme.id);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#0f0e0b] text-[#faf8f3]'
                        : 'border border-[#0f0e0b]/30 text-[#0f0e0b] hover:bg-[#0f0e0b] hover:text-[#faf8f3]'
                    }`}
                  >
                    {isActive ? 'Applied' : 'Apply Live'}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-[#f2ede4] border border-[#0f0e0b]/10 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-[#0f0e0b]/70">
            Selected theme is saved in your browser session and immediately affects all pages, buttons, cards, and modals.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#0f0e0b] text-[#faf8f3] text-xs font-semibold uppercase tracking-widest rounded-xs self-end sm:self-auto shrink-0"
          >
            Done Viewing
          </button>
        </div>
      </div>
    </div>
  );
};
