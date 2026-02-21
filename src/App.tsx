import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SimulationProvider, useSimulation } from './context/SimulationContext';
import DashboardLayout from './components/layout/DashboardLayout';
import AuthPage from './pages/AuthPage';
import { Loader2 } from 'lucide-react';

// Pages
import Onboarding from './pages/auth/OnboardingNew'; // Using new 3-step wizard
import Dashboard from './pages/dashboard/Dashboard'; // New Business DNA Dashboard
import Focus from './pages/dashboard/Focus';
import Landscape from './pages/dashboard/Landscape';
import Horizon from './pages/dashboard/Horizon';
import Reflection from './pages/dashboard/Reflection';
import Settings from './pages/dashboard/Settings';
import KnowledgeBase from './pages/dashboard/KnowledgeBase';
import MarketIntelligence from './pages/dashboard/MarketIntelligence';
import LeadSniperFeed from './pages/dashboard/LeadSniperFeed';

// Loading screen component
function LoadingScreen({ message = 'טוען...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
}

// Protected routes that check onboarding status
function ProtectedRoutes() {
  const { hasCompletedOnboarding, isLoadingProfile } = useSimulation();

  // Still loading profile from API
  if (isLoadingProfile) {
    return <LoadingScreen message="טוען את העסק שלך..." />;
  }

  // User hasn't completed onboarding - force to onboarding
  if (!hasCompletedOnboarding) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // User has completed onboarding - show dashboard
  return (
    <Routes>
      {/* Dashboard Routes */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="home" element={<Dashboard />} />
        <Route path="focus" element={<Focus />} />
        <Route path="landscape" element={<Landscape />} />
        <Route path="intelligence" element={<MarketIntelligence />} />
        <Route path="sniper" element={<LeadSniperFeed />} />
        <Route path="horizon" element={<Horizon />} />
        <Route path="reflection" element={<Reflection />} />
        <Route path="settings" element={<Settings />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
      </Route>

      {/* Redirect everything else to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// App content that checks auth state
function AppContent() {
  const { user, loading } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return <LoadingScreen message="מתחבר..." />;
  }

  // If not logged in, show auth page
  if (!user) {
    return <AuthPage />;
  }

  // User is logged in - wrap with SimulationProvider and show protected routes
  return (
    <SimulationProvider>
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </SimulationProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
