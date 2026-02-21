import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AiAssistant from '../ui/AiAssistant';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Fixed on Right (RTL) */}
      <Sidebar />

      {/* Main Content - Offset for sidebar */}
      <main className="flex-1 mr-72 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Floating AI Assistant */}
      <AiAssistant />
    </div>
  );
}
