import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'nps' | 'general';
  trigger?: 'day_7' | 'day_14' | 'day_30' | 'manual';
}

const NPS_EMOJIS = ['😡', '😠', '😤', '😒', '😐', '🙂', '😊', '😃', '😄', '🤩', '🥳'];

export default function FeedbackModal({
  isOpen,
  onClose,
  mode = 'general',
  trigger = 'manual',
}: FeedbackModalProps) {
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'feature_request' | 'bug' | 'general'>('general');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNpsScore(null);
      setMessage('');
      setCategory('general');
      setSubmitted(false);
      setError(null);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (mode === 'nps' && npsScore === null) {
      setError('נא לבחור ציון');
      return;
    }
    if (mode === 'general' && !message.trim()) {
      setError('נא לכתוב הודעה');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/feedback/submit', {
        method: 'POST',
        body: JSON.stringify({
          type: mode === 'nps' ? 'nps' : category,
          score: mode === 'nps' ? npsScore : undefined,
          message: message.trim() || undefined,
          trigger,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        // Mark in localStorage to avoid re-triggering auto-popups
        if (trigger !== 'manual') {
          localStorage.setItem(`qe_feedback_${trigger}`, new Date().toISOString());
        }
      } else {
        setError('שגיאה בשליחה, נסה שוב');
      }
    } catch {
      setError('שגיאה בשליחה, נסה שוב');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

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

        {submitted ? (
          /* Success State */
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🙏</div>
            <h2 className="text-xl font-bold text-white mb-2">תודה על הפידבק!</h2>
            <p className="text-gray-400 mb-6">
              המשוב שלך עוזר לנו לשפר את Quieteyes עבורך ועבור כל המשתמשים.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
            >
              סגור
            </button>
          </div>
        ) : mode === 'nps' ? (
          /* NPS Mode */
          <div>
            <h2 className="text-xl font-bold text-white mb-2 text-center">מה דעתך על Quieteyes?</h2>
            <p className="text-gray-400 text-center text-sm mb-6">
              בסקאלה של 0-10, כמה סביר שתמליץ עלינו לחבר?
            </p>

            {/* NPS Scale */}
            <div className="flex justify-center gap-1.5 mb-2">
              {NPS_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setNpsScore(i)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                    npsScore === i
                      ? 'bg-indigo-600 scale-110 shadow-lg shadow-indigo-500/30'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-6 px-1">
              <span>לא סביר</span>
              <span>סביר מאוד</span>
            </div>

            {/* Optional message */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="רוצה להוסיף משהו? (אופציונלי)"
              rows={3}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none mb-4"
            />

            {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading || npsScore === null}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              שלח ציון
            </button>
          </div>
        ) : (
          /* General Feedback Mode */
          <div>
            <h2 className="text-xl font-bold text-white mb-2 text-center">יש לך משהו לומר?</h2>
            <p className="text-gray-400 text-center text-sm mb-6">
              כל פידבק עוזר לנו להשתפר
            </p>

            {/* Category selector */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'general' as const, label: 'כללי' },
                { id: 'feature_request' as const, label: 'בקשת פיצ\'ר' },
                { id: 'bug' as const, label: 'באג' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    category === cat.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="ספר לנו..."
              rows={4}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none mb-4"
            />

            {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              שלח פידבק
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to check if a feedback auto-popup should show.
 * Call this in the main layout to trigger NPS at day 7/14/30.
 */
export function useFeedbackTrigger(): {
  shouldShow: boolean;
  trigger: 'day_7' | 'day_14' | 'day_30' | null;
  mode: 'nps' | 'general';
} {
  const activatedAt = localStorage.getItem('qe_beta_activated_at');
  if (!activatedAt) return { shouldShow: false, trigger: null, mode: 'general' };

  const now = new Date();
  const activated = new Date(activatedAt);
  const days = Math.floor((now.getTime() - activated.getTime()) / (1000 * 60 * 60 * 24));

  // Check each trigger in order
  const triggers: Array<{ day: number; trigger: 'day_7' | 'day_14' | 'day_30'; mode: 'nps' | 'general' }> = [
    { day: 7, trigger: 'day_7', mode: 'nps' },
    { day: 14, trigger: 'day_14', mode: 'general' },
    { day: 30, trigger: 'day_30', mode: 'nps' },
  ];

  for (const t of triggers) {
    if (days >= t.day) {
      const sent = localStorage.getItem(`qe_feedback_${t.trigger}`);
      if (!sent) {
        return { shouldShow: true, trigger: t.trigger, mode: t.mode };
      }
    }
  }

  return { shouldShow: false, trigger: null, mode: 'general' };
}
