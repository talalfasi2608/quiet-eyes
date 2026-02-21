import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

export default function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'אישור',
  cancelText = 'ביטול',
}: ActionModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-card max-w-md w-full mx-4 fade-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-gray-400 mb-6">{description}</p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="btn-primary flex-1"
            >
              {confirmText}
            </button>
            <button
              onClick={onClose}
              className="btn-ghost flex-1"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
