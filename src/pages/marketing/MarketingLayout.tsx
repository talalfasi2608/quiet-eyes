import { Outlet } from 'react-router-dom';
import Navbar from '../../components/marketing/Navbar';
import Footer from '../../components/marketing/Footer';

export default function MarketingLayout() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a', color: '#f0f4ff' }}>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
