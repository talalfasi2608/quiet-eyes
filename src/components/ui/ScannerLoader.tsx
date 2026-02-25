interface ScannerLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { container: 'w-24 h-24', text: 'text-xs', gap: 'mt-3' },
  md: { container: 'w-40 h-40', text: 'text-sm', gap: 'mt-5' },
  lg: { container: 'w-56 h-56', text: 'text-base', gap: 'mt-6' },
};

export default function ScannerLoader({
  message = 'סורק את הרשת...',
  size = 'md',
  className = '',
}: ScannerLoaderProps) {
  const s = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className={`${s.container} relative`}>
        {/* Concentric circles */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
          {/* Outer ring */}
          <circle
            cx="100" cy="100" r="90"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            opacity="0.4"
          />
          {/* Middle ring */}
          <circle
            cx="100" cy="100" r="60"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            opacity="0.3"
          />
          {/* Inner ring */}
          <circle
            cx="100" cy="100" r="30"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            opacity="0.2"
          />

          {/* Cross lines */}
          <line x1="100" y1="5" x2="100" y2="195" stroke="var(--border)" strokeWidth="0.5" opacity="0.2" />
          <line x1="5" y1="100" x2="195" y2="100" stroke="var(--border)" strokeWidth="0.5" opacity="0.2" />

          {/* Center dot */}
          <circle cx="100" cy="100" r="4" fill="var(--accent-primary)" opacity="0.6">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Scanner sweep — rotating gradient arc */}
          <g className="origin-center">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 100 100"
              to="360 100 100"
              dur="3s"
              repeatCount="indefinite"
            />
            {/* Sweep cone */}
            <defs>
              <linearGradient id="sweep-grad" gradientTransform="rotate(90)">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0" />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            <path
              d="M 100,100 L 100,10 A 90,90 0 0,1 163.6,36.4 Z"
              fill="url(#sweep-grad)"
            />
            {/* Sweep leading edge */}
            <line
              x1="100" y1="100" x2="100" y2="10"
              stroke="var(--accent-primary)"
              strokeWidth="1.5"
              opacity="0.6"
            />
          </g>

          {/* Blip dots — simulated detections */}
          <circle cx="75" cy="55" r="3" fill="var(--accent-primary)" opacity="0">
            <animate attributeName="opacity" values="0;0.8;0" dur="3s" begin="0.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="140" cy="80" r="2.5" fill="var(--accent-primary)" opacity="0">
            <animate attributeName="opacity" values="0;0.6;0" dur="3s" begin="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="130" r="2" fill="var(--accent-primary)" opacity="0">
            <animate attributeName="opacity" values="0;0.7;0" dur="3s" begin="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* Message */}
      <p
        className={`${s.gap} ${s.text} text-[var(--text-secondary)] font-medium`}
        dir="rtl"
      >
        {message}
      </p>
    </div>
  );
}
