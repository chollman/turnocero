// Shared building blocks for TurnoCero designs

// ============================================================
// GameTile — generates a unique geometric pattern per game
// ============================================================
function GameTile({ game, seed = 1, size = 80, palette }) {
  // Hash game name to color hue
  let h = 0;
  for (let i = 0; i < game.length; i++) h = (h * 31 + game.charCodeAt(i)) >>> 0;
  const variants = palette || [
    ['#1888ef', '#0a4a85', '#062242'],
    ['#00aeff', '#1a5fa8', '#0a2c4a'],
    ['#5a8cff', '#1e3a72', '#0a1c3a'],
    ['#2dd4bf', '#0f5d56', '#062924'],
    ['#a78bfa', '#4a3a85', '#1e1535'],
    ['#f97373', '#7a2e35', '#2a0e12'],
  ];
  const colors = variants[h % variants.length];
  const pattern = (seed + h) % 6;

  // Render different geometric patterns
  const renderPattern = () => {
    switch (pattern) {
      case 0: // diagonal stripes
        return (
          <g>
            <rect width="100" height="100" fill={colors[2]} />
            {[...Array(8)].map((_, i) => (
              <rect key={i} x={-20 + i * 18} y="-20" width="9" height="180" fill={colors[1]} transform="rotate(45 50 50)" />
            ))}
            <circle cx="78" cy="22" r="12" fill={colors[0]} />
          </g>
        );
      case 1: // concentric squares
        return (
          <g>
            <rect width="100" height="100" fill={colors[2]} />
            <rect x="10" y="10" width="80" height="80" fill="none" stroke={colors[1]} strokeWidth="3" />
            <rect x="22" y="22" width="56" height="56" fill="none" stroke={colors[1]} strokeWidth="3" />
            <rect x="34" y="34" width="32" height="32" fill={colors[0]} />
          </g>
        );
      case 2: // dice dots
        return (
          <g>
            <rect width="100" height="100" fill={colors[2]} />
            <rect x="14" y="14" width="72" height="72" rx="10" fill={colors[1]} />
            {[[30,30],[70,30],[30,50],[70,50],[30,70],[70,70]].map(([cx,cy],i) => (
              <circle key={i} cx={cx} cy={cy} r="6" fill={colors[0]} />
            ))}
          </g>
        );
      case 3: // triangles / pennants
        return (
          <g>
            <rect width="100" height="100" fill={colors[2]} />
            <polygon points="0,0 50,60 100,0" fill={colors[1]} />
            <polygon points="0,100 50,40 100,100" fill={colors[0]} opacity="0.85" />
            <circle cx="50" cy="50" r="8" fill={colors[2]} />
          </g>
        );
      case 4: // hex / grid
        return (
          <g>
            <rect width="100" height="100" fill={colors[2]} />
            {[0,1,2].map(r => [0,1,2,3].map(c => (
              <polygon
                key={`${r}-${c}`}
                points="0,-12 10,-6 10,6 0,12 -10,6 -10,-6"
                transform={`translate(${15 + c*22 + (r%2)*11},${20 + r*22})`}
                fill={(r+c)%2 ? colors[1] : colors[0]}
              />
            )))}
          </g>
        );
      case 5: // arcs / circles
      default:
        return (
          <g>
            <rect width="100" height="100" fill={colors[2]} />
            <circle cx="20" cy="80" r="60" fill={colors[1]} />
            <circle cx="80" cy="20" r="35" fill={colors[0]} />
            <circle cx="50" cy="50" r="6" fill={colors[2]} />
          </g>
        );
    }
  };

  const initials = game.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ width: size, height: size, position: 'relative', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        {renderPattern()}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 6,
        fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: typeof size === 'number' ? size * 0.18 : 14,
        color: '#fff', letterSpacing: '0.04em', textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }}>{initials}</div>
    </div>
  );
}

// ============================================================
// PhoneFrame — minimal phone bezel for mobile artboards
// ============================================================
function PhoneFrame({ children, theme = '#0a0d15' }) {
  return (
    <div style={{
      width: 390,
      height: 780,
      borderRadius: 44,
      padding: 12,
      background: 'linear-gradient(180deg,#1a1d28,#0d0f17)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
      flexShrink: 0,
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        background: theme,
        position: 'relative',
      }}>
        {/* status bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px 0 28px', fontSize: 13, fontWeight: 600, color: '#fff',
          fontFamily: 'Manrope, sans-serif', zIndex: 100,
        }}>
          <span>9:41</span>
          <div style={{
            position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)',
            width: 100, height: 24, background: '#000', borderRadius: 14,
          }} />
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11 }}>●●●</span>
            <span style={{ width: 18, height: 9, border: '1px solid #fff', borderRadius: 2, position: 'relative' }}>
              <span style={{ position: 'absolute', inset: 1, background: '#fff', borderRadius: 1 }} />
            </span>
          </span>
        </div>
        <div style={{ paddingTop: 36, height: '100%', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Icons
// ============================================================
const Icon = {
  Calendar: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  Pin: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>),
  Users: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Crown: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-11-5 4-3-7-3 7-5-4-2 11zm0 2h20v2H2v-2z"/></svg>),
  Lock: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
  Globe: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12 15.3 15.3 0 0 1 12 2z"/></svg>),
  Plus: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Search: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  Bell: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>),
  Dice: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>),
  Star: ({ size = 16, filled = false }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
  Send: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>),
  Camera: ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>),
};

window.GameTile = GameTile;
window.PhoneFrame = PhoneFrame;
window.Icon = Icon;
