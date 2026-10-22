import React, { useState, useRef, useEffect } from 'react';
import {
  Moon,
  Sun,
  Check,
  ChevronDown,
  Palette,
  Eye,
  Compass,
  Sliders,
  Type,
  ZapOff,
  CheckCircle2,
  Monitor,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, ThemeId, ThemeOption } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

interface ThemeSelectorProps {
  compact?: boolean;
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  compact = false,
  className = '',
}) => {
  const {
    themeId,
    activeTheme,
    availableThemes,
    setThemeId,
    isDark,
    highContrastMode,
    toggleHighContrastMode,
    reducedMotion,
    toggleReducedMotion,
    largeText,
    toggleLargeText,
  } = useTheme();
  const { language, isRTL , t} = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'themes' | 'accessibility'>('themes');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click or ESC key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const darkThemes = availableThemes.filter((t) => t.category === 'dark' && t.id !== 'high-contrast-pro');
  const lightThemes = availableThemes.filter((t) => t.category === 'light');
  const proTheme = availableThemes.find((t) => t.id === 'high-contrast-pro');

  const getThemeIcon = (id: ThemeId) => {
    switch (id) {
      case 'abyss':
        return Moon;
      case 'salt':
        return Sun;
      case 'high-contrast-pro':
        return Eye;
      default:
        return Palette;
    }
  };

  const getShortName = (theme: ThemeOption) => {
    if (theme.id === 'high-contrast-pro') return t('nav.highContrast');
    return language === 'ar' ? theme.nameAr : theme.nameEn;
  };

  const ActiveIcon = getThemeIcon(themeId);

  return (
    <div className={`relative inline-block text-start ${className}`} ref={dropdownRef}>
      {/* Sleek Minimalist Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        id="theme-selector-trigger-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Theme: ${getShortName(activeTheme)}. Open Theme Menu.`}
        title={t('nav.theme', { getShortName_activeTheme_: getShortName(activeTheme) })}
        className={`group relative h-9 px-2.5 sm:px-3 rounded-full flex items-center gap-2 transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer border shadow-sm select-none ${
          isDark
            ? 'bg-[var(--surface-container)]/90 hover:bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-on-media)] hover:border-[var(--border-subtle)]'
            : 'bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] border-[var(--text-primary)]/12 text-[var(--text-primary)] hover:border-[var(--text-primary)]/20'
        } ${isOpen ? 'ring-2 ring-[var(--focus-ring)]' : ''}`}
      >
        {/* Dynamic Theme Icon with Glowing Dot */}
        <div className="relative flex items-center justify-center">
          <ActiveIcon
            className="w-4 h-4 transition-transform group-hover:scale-110"
            style={{ color: activeTheme.swatches.accent }}
          />
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-black"
            style={{ backgroundColor: activeTheme.swatches.accentSecondary }}
          />
        </div>

        {/* Short Clean Name */}
        <span className="text-xs font-semibold tracking-tight hidden min-[1500px]:inline whitespace-nowrap">
          {getShortName(activeTheme)}
        </span>

        {/* Color Palette Duo Dot */}
        <div className="flex items-center -space-x-1">
          <div
            className="w-2.5 h-2.5 rounded-full border border-[var(--border-subtle)] shadow-xs"
            style={{ backgroundColor: activeTheme.swatches.bg }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full border border-[var(--border-subtle)] shadow-xs"
            style={{ backgroundColor: activeTheme.swatches.accent }}
          />
        </div>

        {/* Subtle Chevron */}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${
            isOpen ? 'rotate-180 opacity-100' : 'group-hover:opacity-90'
          }`}
        />
      </button>

      {/* Modern Compact Floating Glass Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            dir={isRTL ? 'rtl' : 'ltr'}
            role="dialog"
            aria-modal="true"
            aria-label="Theme Selector"
            className={`absolute mt-2 w-72 sm:w-80 z-50 rounded-2xl p-3 shadow-2xl border backdrop-blur-2xl transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
              isRTL ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
            } ${
              isDark
                ? 'bg-[var(--surface-container)]/98 border-[var(--border-subtle)] text-[var(--text-on-media)] shadow-[0_20px_50px_rgba(0,0,0,0.85)]'
                // Light mode used `--btn-util-bg` (a 7-8% tint), so the menu
                // composited over the hero photograph: the same 11px label
                // measured 4.54:1 (en) and 2.88:1 (ar) on the SAME theme,
                // because the surface moved, not the ink. Tier 2 of the glass
                // ladder is the system's own answer for a plate over imagery.
                : 'bg-[var(--glass-soft-bg)] border-[var(--text-primary)]/15 text-[var(--text-primary)] shadow-[0_20px_50px_rgba(18,36,32,0.15)]'
            }`}
          >
            {/* Header: Minimal Icon Tabs */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[var(--border-subtle)] dark:border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-xs font-bold">
                  {t('nav.appearance')}
                </span>
              </div>

              {/* Segmented Switcher */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('themes')}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'themes'
                      ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Palette className="w-3 h-3" />
                  <span>{t('nav.themes')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accessibility')}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'accessibility'
                      ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>{t('nav.a11y')}</span>
                </button>
              </div>
            </div>

            {/* TAB 1: THEMES SELECTION (CLEAN ICONIC GRID & NO NOISY PARAGRAPHS) */}
            {activeTab === 'themes' && (
              <div className="space-y-3" role="radiogroup" aria-label="Themes">
                {/* 1. Dark Modes Section */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] mb-1.5 px-1">
                    <Moon className="w-3 h-3 text-[var(--accent-primary)]" />
                    <span>{t('nav.darkMode')}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {darkThemes.map((opt) => renderCleanThemePill(opt))}
                  </div>
                </div>

                {/* 2. Light Modes Section */}
                <div className="pt-2 border-t border-[var(--border-subtle)] dark:border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] mb-1.5 px-1">
                    <Sun className="w-3 h-3 text-[var(--accent-secondary)]" />
                    <span>{t('nav.lightMode')}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {lightThemes.map((opt) => renderCleanThemePill(opt))}
                  </div>
                </div>

                {/* 3. Ultra High Contrast Mode (Single Sleek Pill) */}
                {proTheme && (
                  <div className="pt-2 border-t border-[var(--border-subtle)] dark:border-[var(--border-subtle)]">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-accent)] mb-1.5 px-1">
                      <Eye className="w-3 h-3 text-[var(--text-accent)]" />
                      <span>{t('nav.highContrast')}</span>
                    </div>
                    {renderCleanThemePill(proTheme, true)}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ACCESSIBILITY CONTROLS (CLEAN ICONIC TOGGLES) */}
            {activeTab === 'accessibility' && (
              <div className="space-y-2 py-1 animate-in fade-in duration-150">
                {/* Toggle 1: High Contrast Outlines */}
                <button
                  type="button"
                  onClick={toggleHighContrastMode}
                  className={`w-full p-2 rounded-xl border text-start flex items-center justify-between gap-3 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                    highContrastMode
                      ? 'bg-amber-500/15 border-amber-500 text-[var(--text-primary)]'
                      : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${highContrastMode ? 'bg-amber-500 text-black' : 'bg-black/10 dark:bg-[var(--btn-util-bg)]'}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold">
                      {t('nav.highContrastOutlines')}
                    </span>
                  </div>
                  <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${highContrastMode ? 'bg-amber-500' : 'bg-gray-400/40'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-[var(--surface-card)] transition-transform ${highContrastMode ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </div>
                </button>

                {/* Toggle 2: Large Text */}
                <button
                  type="button"
                  onClick={toggleLargeText}
                  className={`w-full p-2 rounded-xl border text-start flex items-center justify-between gap-3 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                    largeText
                      ? 'bg-[var(--accent-secondary)]/15 border-[var(--accent-secondary)] text-[var(--text-primary)]'
                      : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${largeText ? 'bg-[var(--accent-secondary)] text-[var(--accent-secondary-ink)]' : 'bg-black/10 dark:bg-[var(--btn-util-bg)]'}`}>
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold">
                      {t('nav.largeText110')}
                    </span>
                  </div>
                  <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${largeText ? 'bg-[var(--accent-secondary)]' : 'bg-gray-400/40'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-[var(--surface-card)] transition-transform ${largeText ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </div>
                </button>

                {/* Toggle 3: Reduced Motion */}
                <button
                  type="button"
                  onClick={toggleReducedMotion}
                  className={`w-full p-2 rounded-xl border text-start flex items-center justify-between gap-3 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                    reducedMotion
                      ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--text-primary)]'
                      : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${reducedMotion ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]' : 'bg-black/10 dark:bg-[var(--btn-util-bg)]'}`}>
                      <ZapOff className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold">
                      {t('nav.reduceMotion')}
                    </span>
                  </div>
                  <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${reducedMotion ? 'bg-[var(--accent-primary)]' : 'bg-gray-400/40'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-[var(--surface-card)] transition-transform ${reducedMotion ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            )}

            {/* Minimalist Micro Footer */}
            <div className="pt-2 mt-2.5 border-t border-[var(--border-subtle)] dark:border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-1">
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-[var(--text-accent)]" />
                <span>WCAG AAA</span>
              </span>
              <span className="font-mono text-[11px] opacity-70">
                {activeTheme.contrastRatio}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Clean Iconic Pill Render function (No clutter, No multi-line noise)
  function renderCleanThemePill(opt: ThemeOption, isSpecial = false) {
    const isSelected = opt.id === themeId;
    const Icon = getThemeIcon(opt.id);

    return (
      <button
        key={opt.id}
        type="button"
        role="radio"
        aria-checked={isSelected}
        id={`theme-option-${opt.id}`}
        onClick={() => setThemeId(opt.id)}
        className={`w-full h-10 px-2.5 rounded-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 flex items-center justify-between gap-2.5 cursor-pointer border relative group ${
          isSelected
            ? 'bg-[var(--surface-container)] border-[var(--focus-ring)] shadow-xs ring-1 ring-[var(--focus-ring)]'
            : isSpecial
            ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30'
            : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
        }`}
      >
        {/* Left: Icon & Clean Short Label */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
            style={{
              backgroundColor: `${opt.swatches.accent}18`,
              color: opt.swatches.accent,
            }}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>

          <span
            className={`text-xs truncate ${
              isSelected
                ? 'font-bold text-[var(--text-primary)]'
                : 'font-medium text-[var(--text-primary)] opacity-90 group-hover:opacity-100'
            }`}
          >
            {getShortName(opt)}
          </span>
        </div>

        {/* Right: Color Palette Preview & Selection Check */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 3-Dot Swatch Capsule */}
          <div
            className="flex items-center p-0.5 rounded-full border border-[var(--border-subtle)] gap-0.5"
            style={{ backgroundColor: opt.swatches.bg }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full border border-[var(--border-subtle)]"
              style={{ backgroundColor: opt.swatches.card }}
            />
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: opt.swatches.accent }}
            />
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: opt.swatches.accentSecondary }}
            />
          </div>

          {/* Active Check Indicator */}
          {isSelected && (
            <div
              className="w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: opt.swatches.accent,
                color: opt.swatches.bg,
              }}
            >
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
          )}
        </div>
      </button>
    );
  }
};
