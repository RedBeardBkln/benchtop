import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
      {/* Top ring — teal, outer_r=7, center=(16,10) */}
      <div
        style={{
          position: 'absolute',
          top: '3px',
          left: '9px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: '3px solid #3CAF8E',
        }}
      />
      {/* Bottom ring — amber, outer_r=8, center=(16,21) */}
      <div
        style={{
          position: 'absolute',
          top: '13px',
          left: '8px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '3px solid #E8A030',
        }}
      />
    </div>,
    { ...size },
  )
}
