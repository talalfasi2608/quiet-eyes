import { Link } from 'react-router-dom';

const columns = [
  {
    title: 'מוצר',
    links: [
      { label: 'תכונות', to: '/features' },
      { label: 'תמחור', to: '/pricing' },
      { label: 'API', to: '/features' },
    ],
  },
  {
    title: 'חברה',
    links: [
      { label: 'אודות', to: '/about' },
      { label: 'בלוג', to: '/blog' },
      { label: 'קריירה', to: '/about' },
    ],
  },
  {
    title: 'משפטי',
    links: [
      { label: 'פרטיות', to: '/privacy' },
      { label: 'תנאי שימוש', to: '/terms' },
    ],
  },
];

export default function Footer() {
  return (
    <footer style={{ background: '#080c16', borderTop: '1px solid rgba(30,45,69,0.5)' }}>
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="text-lg font-extrabold" style={{ color: '#f0f4ff' }}>
              Quiet<span style={{ color: '#00d4ff' }}>eyes</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: '#8899aa' }}>
              פלטפורמת מודיעין עסקי מבוססת AI לעסקים קטנים ובינוניים.
            </p>
          </div>

          {/* Link columns */}
          {columns.map(col => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-4" style={{ color: '#f0f4ff' }}>{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm transition-colors duration-200"
                      style={{ color: '#8899aa' }}
                      onMouseEnter={e => (e.target as HTMLElement).style.color = '#00d4ff'}
                      onMouseLeave={e => (e.target as HTMLElement).style.color = '#8899aa'}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(30,45,69,0.3)' }}>
          <p className="text-xs" style={{ color: '#4a5568' }}>
            &copy; 2026 Quieteyes. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: '#4a5568' }}>
            Made in Israel
          </p>
        </div>
      </div>
    </footer>
  );
}
