import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

export default function PageLoader({ message = 'טוען...' }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      <p className="text-gray-400">{message}</p>
    </div>
  );
}
