import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type DahabTimePhase = 'morning' | 'midday' | 'goldenHour' | 'night';

export interface DahabTimeContextValue {
  timePhase: DahabTimePhase;
  isAuto: boolean;
  setManualPhase: (phase: DahabTimePhase | null) => void;
  greetingEn: string;
  greetingAr: string;
  subtextEn: string;
  subtextAr: string;
  accentColor: string;
  ambientColor: string;
  badgeClass: string;
}

const DahabTimeContext = createContext<DahabTimeContextValue | undefined>(undefined);

/**
 * Calculates current Dahab Time Phase based on Sinai local time (UTC+2)
 */
function getCalculatedPhase(): DahabTimePhase {
  const now = new Date();
  // Egypt is UTC+2 (or UTC+3 during DST)
  const egyptHours = (now.getUTCHours() + 2) % 24;

  if (egyptHours >= 5 && egyptHours < 11.5) {
    return 'morning';
  }
  if (egyptHours >= 11.5 && egyptHours < 16.5) {
    return 'midday';
  }
  if (egyptHours >= 16.5 && egyptHours < 19.5) {
    return 'goldenHour';
  }
  return 'night';
}

export const DahabTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [manualPhase, setManualPhaseState] = useState<DahabTimePhase | null>(null);
  const [autoPhase, setAutoPhase] = useState<DahabTimePhase>(getCalculatedPhase);

  useEffect(() => {
    const interval = setInterval(() => {
      setAutoPhase(getCalculatedPhase());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const activePhase = manualPhase || autoPhase;

  const value = useMemo<DahabTimeContextValue>(() => {
    switch (activePhase) {
      case 'morning':
        return {
          timePhase: 'morning',
          isAuto: manualPhase === null,
          setManualPhase: setManualPhaseState,
          greetingEn: 'Good Morning from Dahab',
          greetingAr: 'صباح الخير من دهب',
          subtextEn: 'The sea is glassy, calm & perfect for reef snorkeling.',
          subtextAr: 'البحر هادي وصافي ومثالي للسباحة والسنوركلنج.',
          accentColor: '#20A89A',
          ambientColor: '#1C1917',
          badgeClass: 'badge-dahab-lagoon',
        };
      case 'midday':
        return {
          timePhase: 'midday',
          isAuto: manualPhase === null,
          setManualPhase: setManualPhaseState,
          greetingEn: 'Midday Red Sea Sunlight',
          greetingAr: 'ظهيرة البحر الأحمر الصافية',
          subtextEn: 'Peak 30m+ underwater visibility & active lagoon wind.',
          subtextAr: 'رؤية فائقة تحت الماء ورياح نشطة لركوب الأمواج.',
          accentColor: '#E7A83B',
          ambientColor: '#0F6F78',
          badgeClass: 'badge-dahab-gold',
        };
      case 'goldenHour':
        return {
          timePhase: 'goldenHour',
          isAuto: manualPhase === null,
          setManualPhase: setManualPhaseState,
          greetingEn: 'Golden Hour Over South Sinai',
          greetingAr: 'ساعة الغروب الذهبية في سيناء',
          subtextEn: 'Pink granite mountains & warm waterfront breeze.',
          subtextAr: 'جبال سيناء باللون الوردي ونسيم ساحر على الممشى.',
          accentColor: '#D96C4F',
          ambientColor: '#0A1E24',
          badgeClass: 'badge-dahab-coral',
        };
      case 'night':
      default:
        return {
          timePhase: 'night',
          isAuto: manualPhase === null,
          setManualPhase: setManualPhaseState,
          greetingEn: 'Sinai Starlight Over the Gulf',
          greetingAr: 'سكون الليل ونجوم سيناء',
          subtextEn: 'Acoustic melodies, Bedouin fires & peaceful waves.',
          subtextAr: 'جلسات بدوية هادية وأنغام بحرية تحت ضوء النجوم.',
          accentColor: '#52C4B7',
          ambientColor: '#141311',
          badgeClass: 'badge-dahab-dark-lagoon',
        };
    }
  }, [activePhase, manualPhase]);

  return <DahabTimeContext.Provider value={value}>{children}</DahabTimeContext.Provider>;
};

export const useDahabTime = (): DahabTimeContextValue => {
  const context = useContext(DahabTimeContext);
  if (!context) {
    throw new Error('useDahabTime must be used within a DahabTimeProvider');
  }
  return context;
};
