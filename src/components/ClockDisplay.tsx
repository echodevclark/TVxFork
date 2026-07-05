import { CSSProperties, useEffect, useState } from 'react';
import { useBlinkingColon } from '@/hooks/useBlinkingColon';

interface ClockDisplayProps {
  time: Date;
  style: 'flip' | 'matrix' | 'digital' | 'minimal' | 'retro' | 'neon';
}

const pad = (n: number) => n.toString().padStart(2, '0');

export const ClockDisplay = ({ time, style }: ClockDisplayProps) => {
  switch (style) {
    case 'flip':
      return <FlipClock time={time} />;
    case 'matrix':
      return <SimpleClock time={time} {...SIMPLE_CLOCKS.matrix} />;
    case 'digital':
      return <SimpleClock time={time} {...SIMPLE_CLOCKS.digital} />;
    case 'minimal':
      return <SimpleClock time={time} {...SIMPLE_CLOCKS.minimal} />;
    case 'retro':
      return <SimpleClock time={time} {...SIMPLE_CLOCKS.retro} />;
    case 'neon':
      return <NeonClock time={time} />;
    default:
      return <FlipClock time={time} />;
  }
};

// Matrix / Digital / Minimal / Retro differ only in styling and the colon's hidden opacity.
interface SimpleClockConfig {
  className: string;
  style?: CSSProperties;
  colonHidden: string;
}

const SIMPLE_CLOCKS: Record<'matrix' | 'digital' | 'minimal' | 'retro', SimpleClockConfig> = {
  matrix: {
    className: 'font-mono text-base font-bold tracking-wider',
    style: { color: '#00ff41', textShadow: '0 0 5px #00ff41, 0 0 10px #00ff41, 0 0 15px #00ff41' },
    colonHidden: 'opacity-0',
  },
  digital: {
    className: 'font-mono text-base font-bold tracking-wide',
    style: { color: '#9ed99c', textShadow: '0 0 3px rgba(158, 217, 156, 0.5)' },
    colonHidden: 'opacity-30',
  },
  minimal: {
    className: 'font-mono text-base text-muted-foreground',
    colonHidden: 'opacity-30',
  },
  retro: {
    className: 'font-mono text-base font-bold tracking-wider',
    style: { color: '#ff3333', textShadow: '0 0 5px #ff3333, 0 0 10px #ff3333' },
    colonHidden: 'opacity-0',
  },
};

const SimpleClock = ({ time, className, style, colonHidden }: { time: Date } & SimpleClockConfig) => {
  const colonVisible = useBlinkingColon();
  return (
    <div className={className} style={style}>
      {pad(time.getHours())}
      <span className={`transition-opacity duration-100 ${colonVisible ? 'opacity-100' : colonHidden}`}>:</span>
      {pad(time.getMinutes())}
    </div>
  );
};

// Flip Clock
const FlipClock = ({ time }: { time: Date }) => {
  const [prevTime, setPrevTime] = useState(time);
  const [flipping, setFlipping] = useState({ hours: false, minutes: false });
  const colonVisible = useBlinkingColon();

  const hours = pad(time.getHours());
  const minutes = pad(time.getMinutes());
  const prevHours = pad(prevTime.getHours());
  const prevMinutes = pad(prevTime.getMinutes());

  useEffect(() => {
    // Intentional: changing digits trigger the flip animation.
    if (hours !== prevHours) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlipping(prev => ({ ...prev, hours: true }));
      setTimeout(() => {
        setFlipping(prev => ({ ...prev, hours: false }));
        setPrevTime(time);
      }, 300);
    }
    if (minutes !== prevMinutes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlipping(prev => ({ ...prev, minutes: true }));
      setTimeout(() => {
        setFlipping(prev => ({ ...prev, minutes: false }));
        setPrevTime(time);
      }, 300);
    }
  }, [time, hours, minutes, prevHours, prevMinutes]);

  return (
    <div className="flex items-center gap-0.5 font-mono text-xs">
      <FlipDigit digit={hours[0]} flipping={flipping.hours} />
      <FlipDigit digit={hours[1]} flipping={flipping.hours} />
      <span className={`mx-0.5 transition-opacity duration-100 ${colonVisible ? 'opacity-100' : 'opacity-20'}`}>
        :
      </span>
      <FlipDigit digit={minutes[0]} flipping={flipping.minutes} />
      <FlipDigit digit={minutes[1]} flipping={flipping.minutes} />
    </div>
  );
};

const FlipDigit = ({ digit, flipping }: { digit: string; flipping: boolean }) => {
  return (
    <div className="relative w-4 h-6 bg-gradient-to-b from-secondary/80 to-secondary rounded-sm overflow-hidden shadow-inner">
      <div className={`absolute inset-0 flex items-center justify-center text-foreground font-bold transition-transform duration-300 ${flipping ? 'animate-flip' : ''}`}>
        {digit}
      </div>
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-black/20" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-black/30" />
    </div>
  );
};

// Neon Clock — has a scanline overlay and a specially-styled colon, so it stays custom.
const NeonClock = ({ time }: { time: Date }) => {
  const colonVisible = useBlinkingColon();

  return (
    <div
      className="font-mono text-base font-bold tracking-wider relative"
      style={{
        color: '#0ff',
        textShadow: '0 0 1px #0ff, 0 0 3px #0088aa',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 255, 255, 0.1) 1px, rgba(0, 255, 255, 0.1) 2px)',
          mixBlendMode: 'overlay',
        }}
      />
      {pad(time.getHours())}
      <span
        className="transition-all duration-300"
        style={{
          opacity: colonVisible ? 1 : 0.15,
          color: colonVisible ? '#0088aa' : '#000',
          textShadow: colonVisible ? '0 0 1px #0088aa, 0 0 2px #006688' : 'none',
        }}
      >
        :
      </span>
      {pad(time.getMinutes())}
    </div>
  );
};
