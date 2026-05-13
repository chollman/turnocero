const PALETTES = [
  ['#1888ef', '#0a4a85', '#062242'],
  ['#00aeff', '#1a5fa8', '#0a2c4a'],
  ['#5a8cff', '#1e3a72', '#0a1c3a'],
  ['#2dd4bf', '#0f5d56', '#062924'],
  ['#a78bfa', '#4a3a85', '#1e1535'],
  ['#f97373', '#7a2e35', '#2a0e12'],
]

function hashGame(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h
}

export default function GameTile({
  game,
  seed = 1,
  size = 80,
  imageUrl = null,
}) {
  const isPercent = typeof size === 'string'

  if (imageUrl) {
    return (
      <div
        style={{
          width: size,
          height: isPercent ? '100%' : size,
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src={imageUrl}
          alt={game}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            display: 'block',
          }}
        />
      </div>
    )
  }

  const h = hashGame(game)
  const colors = PALETTES[h % PALETTES.length]
  const pattern = (seed + h) % 6

  const renderPattern = () => {
    switch (pattern) {
      case 0:
        return (
          <g>
            <rect width='100' height='100' fill={colors[2]} />
            {[...Array(8)].map((_, i) => (
              <rect
                key={i}
                x={-20 + i * 18}
                y='-20'
                width='9'
                height='180'
                fill={colors[1]}
                transform='rotate(45 50 50)'
              />
            ))}
            <circle cx='78' cy='22' r='12' fill={colors[0]} />
          </g>
        )
      case 1:
        return (
          <g>
            <rect width='100' height='100' fill={colors[2]} />
            <rect
              x='10'
              y='10'
              width='80'
              height='80'
              fill='none'
              stroke={colors[1]}
              strokeWidth='3'
            />
            <rect
              x='22'
              y='22'
              width='56'
              height='56'
              fill='none'
              stroke={colors[1]}
              strokeWidth='3'
            />
            <rect x='34' y='34' width='32' height='32' fill={colors[0]} />
          </g>
        )
      case 2:
        return (
          <g>
            <rect width='100' height='100' fill={colors[2]} />
            <rect
              x='14'
              y='14'
              width='72'
              height='72'
              rx='10'
              fill={colors[1]}
            />
            {[
              [30, 30],
              [70, 30],
              [30, 50],
              [70, 50],
              [30, 70],
              [70, 70],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r='6' fill={colors[0]} />
            ))}
          </g>
        )
      case 3:
        return (
          <g>
            <rect width='100' height='100' fill={colors[2]} />
            <polygon points='0,0 50,60 100,0' fill={colors[1]} />
            <polygon
              points='0,100 50,40 100,100'
              fill={colors[0]}
              opacity='0.85'
            />
            <circle cx='50' cy='50' r='8' fill={colors[2]} />
          </g>
        )
      case 4:
        return (
          <g>
            <rect width='100' height='100' fill={colors[2]} />
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <polygon
                  key={`${r}-${c}`}
                  points='0,-12 10,-6 10,6 0,12 -10,6 -10,-6'
                  transform={`translate(${15 + c * 22 + (r % 2) * 11},${20 + r * 22})`}
                  fill={(r + c) % 2 ? colors[1] : colors[0]}
                />
              )),
            )}
          </g>
        )
      default:
        return (
          <g>
            <rect width='100' height='100' fill={colors[2]} />
            <circle cx='20' cy='80' r='60' fill={colors[1]} />
            <circle cx='80' cy='20' r='35' fill={colors[0]} />
            <circle cx='50' cy='50' r='6' fill={colors[2]} />
          </g>
        )
    }
  }

  const initials = game
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const fontSize = isPercent ? 14 : size * 0.18

  return (
    <div
      style={{
        width: size,
        height: isPercent ? '100%' : size,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <svg
        viewBox='0 0 100 100'
        width='100%'
        height='100%'
        preserveAspectRatio='xMidYMid slice'
      >
        {renderPattern()}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          padding: 6,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize,
          color: '#fff',
          letterSpacing: '0.04em',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}
      >
        {initials}
      </div>
    </div>
  )
}
