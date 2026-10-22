import { ImageResponse } from 'next/og'
import { appIconDataUri } from '@/lib/brand'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={appIconDataUri({ size: 192, radius: 0 })} width={192} height={192} alt="" />,
    { width: 192, height: 192 },
  )
}
