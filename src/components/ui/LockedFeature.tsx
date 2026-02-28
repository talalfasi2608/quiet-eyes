import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { PLAN_INFO, type PlanTier } from '../../lib/features';

interface LockedFeatureProps {
  featureName: string;
  emoji: string;
  description: string;
  requiredPlan: PlanTier;
  ctaText?: string;
}

export default function LockedFeature({
  featureName,
  emoji,
  description,
  requiredPlan,
  ctaText,
}: LockedFeatureProps) {
  const navigate = useNavigate();
  const planInfo = PLAN_INFO[requiredPlan];
  const buttonText = ctaText || `שדרג ל-${planInfo.nameEn}`;

  return (
    <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
      <div className="max-w-md text-center space-y-6 p-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto">
          <span className="text-4xl">{emoji}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">{featureName} זמין בתוכנית {planInfo.name}</span>
          </div>
          <h2 className="text-2xl font-bold text-white">{featureName}</h2>
          <p className="text-gray-400 leading-relaxed whitespace-pre-line">{description}</p>
        </div>

        <button
          onClick={() => navigate('/dashboard/billing')}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/20"
        >
          {buttonText}
          <ArrowLeft className="w-4 h-4" />
        </button>

        <p className="text-xs text-gray-600">
          14 יום ניסיון חינם. ביטול בכל עת.
        </p>
      </div>
    </div>
  );
}
