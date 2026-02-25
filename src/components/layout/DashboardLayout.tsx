import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import AiAssistant from '../ui/AiAssistant';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Fixed on Right (RTL) */}
      <Sidebar />

      {/* Main Content - Offset for sidebar */}
      <main className="flex-1 md:mr-72 pt-16 md:pt-6 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
          <Outlet />
        </div>
      </main>

      {/* Floating AI Assistant */}
      <AiAssistant />

      {/* Toast Notifications */}
      <Toaster
        position="top-left"
        toastOptions={{
          className: 'text-sm',
          style: {
            background: '#1e1e2e',
            color: '#e2e8f0',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            direction: 'rtl',
          },
        }}
      />
    </div>
  );
}
