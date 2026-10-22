import { ImageResponse } from 'next/og'
import { appIconDataUri } from '@/lib/brand'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={appIconDataUri({ size: 512, radius: 0 })} width={512} height={512} alt="" />,
    { width: 512, height: 512 },
  )
}
