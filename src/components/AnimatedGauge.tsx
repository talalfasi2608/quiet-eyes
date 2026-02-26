import { useState, useEffect } from 'react';

interface AnimatedGaugeProps {
  value: number;
  size?: number;
  label?: string;
}

export default function AnimatedGauge({ value, size = 160, label }: AnimatedGaugeProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    setDisplayed(0);
    const timer = setInterval(() => {
      setDisplayed(prev => {
        if (prev >= value) {
          clearInterval(timer);
          return value;
        }
        return prev + 2;
      });
    }, 20);
    return () => clearInterval(timer);
  }, [value]);

  const color = value >= 80 ? '#00ff88'
    : value >= 50 ? '#ffaa00'
    : '#ff4466';

  const circumference = 2 * Math.PI * 70;
  const strokeDash = (displayed / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 160 160">
        {/* Background circle */}
        <circle cx="80" cy="80" r="70"
          fill="none" stroke="#1a2a4a" strokeWidth="12"
        />
        {/* Progress circle */}
        <circle cx="80" cy="80" r="70"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          transform="rotate(-90 80 80)"
          style={{ transition: 'stroke-dasharray 0.1s' }}
        />
        {/* Number */}
        <text x="80" y="72"
          textAnchor="middle"
          fill="white" fontSize="36" fontWeight="700"
          fontFamily="var(--font-mono, monospace)"
        >
          {displayed}
        </text>
        <text x="80" y="98"
          textAnchor="middle"
          fill="#8899aa" fontSize="12"
        >
          {'\u05DE\u05EA\u05D5\u05DA 100'}
        </text>
      </svg>
      {label && (
        <span className="text-sm text-gray-400 mt-1">{label}</span>
      )}
    </div>
  );
}
