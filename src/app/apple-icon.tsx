import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0C2B24',
        position: 'relative',
      }}
    >
      {/* Top ring — teal, outer_r=41, center=(90,59) */}
      <div
        style={{
          position: 'absolute',
          top: '18px',
          left: '49px',
          width: '82px',
          height: '82px',
          borderRadius: '50%',
          border: '15px solid #3CAF8E',
        }}
      />
      {/* Bottom ring — amber, outer_r=46, center=(90,117) */}
      <div
        style={{
          position: 'absolute',
          top: '71px',
          left: '44px',
          width: '92px',
          height: '92px',
          borderRadius: '50%',
          border: '16px solid #E8A030',
        }}
      />
    </div>,
    { ...size },
  )
}
