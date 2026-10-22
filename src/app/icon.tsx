import { ImageResponse } from 'next/og'
import { appIconDataUri } from '@/lib/brand'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={appIconDataUri({ size: 32, radius: 0.22 })} width={32} height={32} alt="" />,
    { width: 32, height: 32 },
  )
}
