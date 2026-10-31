'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { btnDanger, btnPrimary, btnSecondary, Card, formatDate, inputCls, Notice } from './ui'

type Connection = { createdAt: string; lastUsedAt: string | null; keyLast4: string } | null

// The invoicing connection key (see lib/invoicing-connection.ts): make one, copy it into the
// invoicing app, replace or revoke it.
export function InvoicingConnectionPanel() {
  const [connection, setConnection] = useState<Connection | undefined>(undefined)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/settings/invoicing-connection')
      .then(async r => (r.ok ? setConnection((await r.json()).connection) : toast.error(await readErrorMessage(r))))
      .catch(() => toast.error('Could not load the connection'))
  }, [])

  const call = async (method: 'POST' | 'DELETE') => {
    setBusy(true)
    try {
      const r = await fetch('/api/settings/invoicing-connection', { method })
      if (!r.ok) return toast.error(await readErrorMessage(r))
      const data = await r.json()
      setConnection(data.connection)
      setNewKey(data.key ?? null)
      if (method === 'DELETE') toast.success('Key revoked')
    } finally {
      setBusy(false)
    }
  }

  const create = () => {
    if (connection && !window.confirm('Make a new key? The current key stops working, so you’ll need to paste the new one into your invoicing app.')) return
    void call('POST')
  }
  const revoke = () => {
    if (window.confirm('Revoke this key? Your invoicing app will no longer be able to read or mark time until you make a new one.')) void call('DELETE')
  }

  return (
    <Card
      title="Invoicing connection"
      description="Lets your invoicing app read your unbilled time for a client, then mark it billed with the invoice number when the invoice is issued (and unbilled again if it's voided). It sees exactly the time you can see here."
    >
      {connection === undefined ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {newKey && (
            <Notice tone="warning">
              <p className="font-medium">Copy this key now. It won’t be shown again.</p>
              <div className="flex gap-2 mt-2">
                <input readOnly value={newKey} className={`${inputCls} font-mono text-xs`} onFocus={e => e.target.select()} aria-label="Connection key" />
                <button
                  type="button"
                  className={btnSecondary}
                  data-tip="Copy the key"
                  onClick={() => navigator.clipboard.writeText(newKey).then(() => toast.success('Copied'), () => toast.error('Could not copy; select the key and copy it'))}
                >
                  <Copy size={14} />
                </button>
              </div>
              <p className="text-xs mt-2">Paste it into your invoicing app’s Benchtop connection setting.</p>
            </Notice>
          )}

          {connection ? (
            <p className="text-sm text-gray-700">
              Key ending <span className="font-mono">…{connection.keyLast4}</span>, made {formatDate(connection.createdAt)}.{' '}
              {connection.lastUsedAt ? `Last used ${formatDate(connection.lastUsedAt)}.` : 'Not used yet.'}
            </p>
          ) : (
            <p className="text-sm text-gray-700">No key yet.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={create}>
              {connection ? 'Make a new key' : 'Make a key'}
            </button>
            {connection && (
              <button type="button" className={btnDanger} disabled={busy} onClick={revoke}>Revoke key</button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
