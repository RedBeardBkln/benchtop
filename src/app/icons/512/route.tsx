import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '512px',
        height: '512px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0C2B24',
        position: 'relative',
      }}
    >
      {/* Top ring — teal, outer_r=117, center=(256,167) */}
      <div
        style={{
          position: 'absolute',
          top: '50px',
          left: '139px',
          width: '234px',
          height: '234px',
          borderRadius: '50%',
          border: '44px solid #3CAF8E',
        }}
      />
      {/* Bottom ring — amber, outer_r=130, center=(256,332) */}
      <div
        style={{
          position: 'absolute',
          top: '202px',
          left: '126px',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          border: '44px solid #E8A030',
        }}
      />
    </div>,
    { width: 512, height: 512 },
  )
}
