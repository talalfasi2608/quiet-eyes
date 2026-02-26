import { useSubscription } from '../../context/SubscriptionContext';

export default function BetaBadge() {
  const { isBetaUser } = useSubscription();

  if (!isBetaUser) return null;

  return (
    <div className="group relative inline-flex">
      <span
        className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider text-white"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
        }}
      >
        BETA
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        משתמש בטא מייסד
      </div>
    </div>
  );
}
