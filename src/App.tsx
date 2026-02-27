import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SimulationProvider, useSimulation } from './context/SimulationContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import DashboardLayout from './components/layout/DashboardLayout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import AuthPage from './pages/AuthPage';
import { Loader2 } from 'lucide-react';

// Lazy-loaded pages (code-split for faster initial load)
const Onboarding = lazy(() => import('./pages/auth/OnboardingNew'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Focus = lazy(() => import('./pages/dashboard/Focus'));
const Landscape = lazy(() => import('./pages/dashboard/Landscape'));
const Horizon = lazy(() => import('./pages/dashboard/Horizon'));
const Reflection = lazy(() => import('./pages/dashboard/Reflection'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const KnowledgeBase = lazy(() => import('./pages/dashboard/KnowledgeBase'));
const MarketIntelligence = lazy(() => import('./pages/dashboard/MarketIntelligence'));
const LeadSniperFeed = lazy(() => import('./pages/dashboard/LeadSniperFeed'));
const Vault = lazy(() => import('./pages/dashboard/Vault'));
const Staff = lazy(() => import('./pages/dashboard/Staff'));
const PlanManagement = lazy(() => import('./pages/dashboard/PlanManagement'));
const SuperAdmin = lazy(() => import('./pages/dashboard/SuperAdmin'));
const Reports = lazy(() => import('./pages/dashboard/Reports'));
const Automations = lazy(() => import('./pages/dashboard/Automations'));
const BetaLanding = lazy(() => import('./pages/public/BetaLanding'));
const BetaOnboarding = lazy(() => import('./pages/auth/BetaOnboarding'));
import RoleGate from './components/auth/RoleGate';

// Marketing pages
const MarketingLayout = lazy(() => import('./pages/marketing/MarketingLayout'));
const MarketingHome = lazy(() => import('./pages/marketing/Home'));
const MarketingFeatures = lazy(() => import('./pages/marketing/Features'));
const MarketingPricing = lazy(() => import('./pages/marketing/Pricing'));
const MarketingAbout = lazy(() => import('./pages/marketing/About'));
const MarketingBlog = lazy(() => import('./pages/marketing/Blog'));

// Loading screen component
function LoadingScreen({ message = 'טוען...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
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
      <Suspense fallback={<LoadingScreen message="טוען..." />}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // User has completed onboarding - show dashboard + marketing pages
  return (
    <ErrorBoundary>
    <Suspense fallback={<LoadingScreen message="טוען..." />}>
    <Routes>
      {/* Marketing pages (accessible when logged in) */}
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<MarketingHome />} />
        <Route path="/features" element={<MarketingFeatures />} />
        <Route path="/pricing" element={<MarketingPricing />} />
        <Route path="/about" element={<MarketingAbout />} />
        <Route path="/blog" element={<MarketingBlog />} />
      </Route>

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
        <Route path="vault" element={<Vault />} />
        <Route path="staff" element={<RoleGate minRole="admin"><Staff /></RoleGate>} />
        <Route path="billing" element={<PlanManagement />} />
        <Route path="reports" element={<Reports />} />
        <Route path="automations" element={<Automations />} />
        <Route path="super-admin" element={<SuperAdmin />} />
      </Route>

      {/* Aliases */}
      <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/beta" element={<BetaLanding />} />
      <Route path="/beta-onboarding" element={<BetaOnboarding />} />
      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

// App content that checks auth state
function AppContent() {
  const { user, loading } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return <LoadingScreen message="מתחבר..." />;
  }

  // If not logged in, show marketing pages with routing
  if (!user) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen message="טוען..." />}>
        <Routes>
          {/* Marketing pages */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<MarketingHome />} />
            <Route path="/features" element={<MarketingFeatures />} />
            <Route path="/pricing" element={<MarketingPricing />} />
            <Route path="/about" element={<MarketingAbout />} />
            <Route path="/blog" element={<MarketingBlog />} />
          </Route>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/beta" element={<BetaLanding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // User is logged in - wrap with providers and show protected routes
  return (
    <WorkspaceProvider>
      <SubscriptionProvider>
        <SimulationProvider>
          <BrowserRouter>
            <ProtectedRoutes />
          </BrowserRouter>
        </SimulationProvider>
      </SubscriptionProvider>
    </WorkspaceProvider>
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
