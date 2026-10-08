'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { btnSecondary } from './ui'

export function SignOutButton() {
  const router = useRouter()
  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <button onClick={signOut} className={btnSecondary}>
      <LogOut size={14} className="mr-2" />
      Sign out
    </button>
  )
}
