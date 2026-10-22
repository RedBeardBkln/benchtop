import { ImageResponse } from 'next/og'
import { appIconDataUri } from '@/lib/brand'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={appIconDataUri({ size: 180, radius: 0 })} width={180} height={180} alt="" />,
    { width: 180, height: 180 },
  )
}
