'use client'

import { useCallback, useEffect } from 'react'

export const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Leave without saving them?'

/**
 * While `dirty`, warns before the page is left: the browser's own prompt on reload, close or
 * typed URL, and a confirm on in-app links (the app router has no navigation events to hook).
 * Returns `confirmLeave()` for navigation done in code (router.push), true when it's OK to go.
 */
export function useUnsavedChangesWarning(dirty: boolean): () => boolean {
  useEffect(() => {
    if (!dirty) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    // Capture phase, so this runs before Next's <Link> handler and can stop it
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page (e.g. a #hash link) isn't leaving
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  return useCallback(() => !dirty || window.confirm(UNSAVED_CHANGES_MESSAGE), [dirty])
}
