import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { to: '/features', label: 'תכונות' },
  { to: '/pricing', label: 'תמחור' },
  { to: '/about', label: 'אודות' },
  { to: '/blog', label: 'בלוג' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <nav className="fixed top-0 inset-x-0 z-50" style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(30,45,69,0.5)' }}>
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-0.5 text-xl font-extrabold tracking-tight" style={{ color: '#f0f4ff' }}>
            Quiet<span style={{ color: '#00d4ff' }}>eyes</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium transition-colors duration-200"
                style={{ color: pathname === l.to ? '#00d4ff' : '#8899aa' }}
                onMouseEnter={e => { if (pathname !== l.to) (e.currentTarget as HTMLElement).style.color = '#f0f4ff'; }}
                onMouseLeave={e => { if (pathname !== l.to) (e.currentTarget as HTMLElement).style.color = '#8899aa'; }}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-1.5 text-sm transition-colors duration-200"
              style={{ color: '#8899aa' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f0f4ff'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8899aa'}
            >
              התחבר
            </Link>
            <Link
              to="/register"
              className="px-5 py-2 text-sm font-semibold rounded transition-colors duration-200"
              style={{ background: '#00d4ff', color: '#0a0e1a' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#00bfe6'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#00d4ff'}
            >
              התחל חינם
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-2xl"
            style={{ color: '#8899aa' }}
            onClick={() => setOpen(!open)}
          >
            {open ? '\u2715' : '\u2630'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden" style={{ background: 'rgba(10,14,26,0.97)', borderTop: '1px solid rgba(30,45,69,0.5)' }}>
          <div className="px-6 py-5 flex flex-col gap-4">
            {navLinks.map(l => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-sm font-medium py-1"
                style={{ color: pathname === l.to ? '#00d4ff' : '#8899aa' }}
              >
                {l.label}
              </Link>
            ))}
            <hr style={{ borderColor: 'rgba(30,45,69,0.5)' }} />
            <Link to="/login" onClick={() => setOpen(false)} className="text-sm py-1" style={{ color: '#8899aa' }}>
              התחבר
            </Link>
            <Link
              to="/register"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 text-sm font-semibold rounded text-center"
              style={{ background: '#00d4ff', color: '#0a0e1a' }}
            >
              התחל חינם
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
