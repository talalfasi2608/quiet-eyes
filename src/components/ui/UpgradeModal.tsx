import { X, ArrowUpRight, Shield, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?: string;
  currentPlan?: string;
}

const PLAN_DISPLAY: Record<string, { name: string; upgrade: string }> = {
  free: { name: 'חינם', upgrade: 'סטארטר' },
  starter: { name: 'סטארטר', upgrade: 'מקצועי' },
  pro: { name: 'מקצועי', upgrade: 'עסקי' },
  business: { name: 'עסקי', upgrade: 'עסקי' },
  // Backward compat
  basic: { name: 'בסיסי', upgrade: 'מקצועי' },
  elite: { name: 'עילית', upgrade: 'עילית' },
};

export default function UpgradeModal({
  isOpen,
  onClose,
  title,
  description,
  feature,
  currentPlan = 'free',
}: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const current = PLAN_DISPLAY[currentPlan] || PLAN_DISPLAY.free;

  const handleUpgrade = () => {
    onClose();
    navigate('/dashboard/billing');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6 border border-gray-700/30"
        style={{
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          {title || 'שדרגו את התוכנית שלכם'}
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-center mb-6">
          {description || 'התכונה הזו דורשת תוכנית גבוהה יותר. שדרגו כדי להשתמש בכל היכולות של QuietEyes.'}
        </p>

        {/* Current vs Recommended */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center mx-auto mb-1">
              <Shield className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500">נוכחי</p>
            <p className="text-sm font-medium text-gray-300">{current.name}</p>
          </div>

          <ArrowUpRight className="w-5 h-5 text-cyan-400" />

          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-1">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs text-cyan-400">מומלץ</p>
            <p className="text-sm font-medium text-white">{current.upgrade}</p>
          </div>
        </div>

        {/* Feature highlight */}
        {feature && (
          <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-3 mb-6 text-center">
            <p className="text-sm text-gray-300">
              תכונה נדרשת: <span className="text-cyan-400 font-medium">{feature}</span>
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
        >
          <ArrowUpRight className="w-4 h-4" />
          שדרג עכשיו – 14 יום חינם
        </button>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-500 mt-4">
          ביטול בכל עת, ללא התחייבות
        </p>
      </div>
    </div>
  );
}
