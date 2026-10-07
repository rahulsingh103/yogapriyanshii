import React from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { DesignThemeId, DESIGN_THEMES } from './DesignShowcaseModal';

interface ThemeDockProps {
  activeTheme: DesignThemeId;
  onSelectTheme: (themeId: DesignThemeId) => void;
  onOpenShowcase: () => void;
}

export const ThemeDock: React.FC<ThemeDockProps> = ({
  activeTheme,
  onSelectTheme,
  onOpenShowcase,
}) => {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#0f0e0b]/92 backdrop-blur-md text-[#faf8f3] border border-white/15 px-3 py-2 shadow-2xl rounded-full flex items-center gap-2 max-w-[95vw] overflow-x-auto text-xs">
      <button
        type="button"
        onClick={onOpenShowcase}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] font-semibold uppercase tracking-wider rounded-full transition-colors shrink-0 text-[11px]"
        title="Open full design showcase modal"
      >
        <Palette className="w-3.5 h-3.5" />
        <span>Design Options</span>
      </button>

      <div className="h-4 w-px bg-white/20 shrink-0" />

      {/* 4 Theme Pills */}
      <div className="flex items-center gap-1 shrink-0">
        {DESIGN_THEMES.map((theme) => {
          const isActive = activeTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className={`px-3 py-1 text-[11px] font-medium rounded-full transition-all flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-white/20 text-[#faf8f3] border border-white/30 font-semibold'
                  : 'text-[#faf8f3]/70 hover:text-[#faf8f3] hover:bg-white/10'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: theme.palette.accent }}
              />
              <span>{theme.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
