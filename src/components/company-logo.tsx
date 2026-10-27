'use client'

import { useBranding } from '@/lib/use-branding'

// The company logo for client-facing documents (formulation printouts, time reports): the team
// logo when an admin applied one, otherwise the user's own. Renders nothing when there's none.
export function CompanyLogo({ className = 'max-h-14 max-w-[220px]' }: { className?: string }) {
  const { data } = useBranding()
  if (!data?.logoUrl) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={data.logoUrl} alt="Company logo" className={`object-contain ${className}`} />
}
