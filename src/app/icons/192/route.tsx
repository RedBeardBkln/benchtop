import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '192px',
        height: '192px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0C2B24',
        position: 'relative',
      }}
    >
      {/* Top ring — teal, outer_r=44, center=(96,63) */}
      <div
        style={{
          position: 'absolute',
          top: '19px',
          left: '52px',
          width: '88px',
          height: '88px',
          borderRadius: '50%',
          border: '17px solid #3CAF8E',
        }}
      />
      {/* Bottom ring — amber, outer_r=49, center=(96,125) */}
      <div
        style={{
          position: 'absolute',
          top: '76px',
          left: '47px',
          width: '98px',
          height: '98px',
          borderRadius: '50%',
          border: '17px solid #E8A030',
        }}
      />
    </div>,
    { width: 192, height: 192 },
  )
}
