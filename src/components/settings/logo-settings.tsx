'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { LOGO_MAX_BYTES } from '@/lib/logo'
import { BRANDING_KEY, useBranding } from '@/lib/use-branding'
import { btnPrimary, btnSecondary, Card, Notice } from './ui'

function LogoPreview({ src, label }: { src: string | null; label: string }) {
  return (
    <div className="flex h-20 w-48 items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-2">
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
        : <span className="text-xs text-gray-400">No logo</span>}
    </div>
  )
}

export function LogoSettings() {
  const queryClient = useQueryClient()
  const { data } = useBranding()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<null | 'upload' | 'remove' | 'apply' | 'unapply'>(null)

  async function run(kind: NonNullable<typeof busy>, req: () => Promise<Response>, done: string, failed: string) {
    setBusy(kind)
    try {
      const res = await req()
      if (!res.ok) { toast.error(await readErrorMessage(res, failed)); return }
      toast.success(done)
      await queryClient.invalidateQueries({ queryKey: BRANDING_KEY })
    } catch {
      toast.error(failed)
    } finally {
      setBusy(null)
    }
  }

  function upload(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error('Use a PNG, JPEG or WEBP image'); return }
    if (file.size > LOGO_MAX_BYTES) { toast.error('The logo must be 2 MB or smaller'); return }
    const body = new FormData()
    body.append('file', file)
    run('upload', () => fetch('/api/settings/logo', { method: 'POST', body }), 'Logo saved', 'Could not save the logo')
  }

  if (!data) {
    return (
      <Card title="Company logo">
        <p className="text-sm text-gray-500">Loading…</p>
      </Card>
    )
  }

  const { own, team, isTeamAdmin } = data

  return (
    <Card
      title="Company logo"
      description="Shown at the top of formulation printouts and PDFs and on time reports. PNG, JPEG or WEBP, up to 2 MB; a wide logo on a transparent or white background prints best."
    >
      <div className="space-y-5">
        {team && (
          <Notice tone="info">
            Your team’s logo is used on your documents{isTeamAdmin ? '' : ' (set by an account admin)'}{own ? ', instead of your own' : ''}.
          </Notice>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <LogoPreview src={own} label="Your logo" />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) upload(file)
              }}
            />
            <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              {busy === 'upload' ? 'Uploading…' : own ? 'Replace logo' : 'Upload logo'}
            </button>
            {own && (
              <button
                type="button"
                className={btnSecondary}
                disabled={busy !== null}
                onClick={() => run('remove', () => fetch('/api/settings/logo', { method: 'DELETE' }), 'Logo removed', 'Could not remove the logo')}
              >
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
        </div>

        {isTeamAdmin && (
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-900">Team logo</h3>
            <p className="text-sm text-gray-500 mt-1">
              Apply your logo to everyone on your team. It’s used on all their documents in place of their own until you stop using it.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {team && <LogoPreview src={team} label="Team logo" />}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy !== null || !own}
                  data-tip={own ? undefined : 'Upload your logo first'}
                  onClick={() => run('apply', () => fetch('/api/team/logo', { method: 'POST' }), 'Your logo is now used for the whole team', 'Could not apply the logo')}
                >
                  {busy === 'apply' ? 'Applying…' : team ? 'Replace with my logo' : 'Use my logo for the whole team'}
                </button>
                {team && (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy !== null}
                    onClick={() => run('unapply', () => fetch('/api/team/logo', { method: 'DELETE' }), 'Team logo removed; everyone’s own logo is used again', 'Could not remove the team logo')}
                  >
                    {busy === 'unapply' ? 'Removing…' : 'Stop using team logo'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
