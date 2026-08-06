import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const BG = '#17253A'
const COL = '#52D4F5'
const R = 22
const BW = 10

const ATOMS: [number, number][] = [
  [160, 72], [160, 177], [160, 282],
  [251, 230], [342, 282], [342, 387],
  [251, 440], [160, 387],
]

const BONDS: [number, number, number, number][] = [
  [160, 72, 160, 177],
  [160, 177, 160, 282],
  [160, 282, 251, 230],
  [251, 230, 342, 282],
  [342, 282, 342, 387],
  [342, 387, 251, 440],
  [251, 440, 160, 387],
  [160, 387, 160, 282],
]

export function GET() {
  const bonds = BONDS.map(([x1, y1, x2, y2], i) => {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    return (
      <div
        key={`b${i}`}
        style={{
          position: 'absolute',
          left: mx - len / 2,
          top: my - BW / 2,
          width: len,
          height: BW,
          backgroundColor: COL,
          borderRadius: BW / 2,
          transform: `rotate(${angle}deg)`,
          transformOrigin: '50% 50%',
        }}
      />
    )
  })

  const atoms = ATOMS.map(([cx, cy], i) => (
    <div
      key={`a${i}`}
      style={{
        position: 'absolute',
        left: cx - R,
        top: cy - R,
        width: R * 2,
        height: R * 2,
        borderRadius: '50%',
        backgroundColor: COL,
      }}
    />
  ))

  return new ImageResponse(
    <div style={{ width: '512px', height: '512px', display: 'flex', backgroundColor: BG, position: 'relative' }}>
      {bonds}
      {atoms}
    </div>,
    { width: 512, height: 512 },
  )
}
