import Link from 'next/link'
import { ChefHat } from 'lucide-react'

/** Floating link that starts a Sous Chef conversation about this project or formulation */
export function AskSousChefButton({ kind, id }: { kind: 'project' | 'formulation'; id: string }) {
  return (
    <Link
      href={`/sous-chef?${kind}=${id}`}
      data-tip={`Ask Sous Chef about this ${kind}`}
      className="fixed z-30 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6 sm:right-6 inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-ink-900 text-lcd-300 text-sm font-medium shadow-lg hover:bg-ink-800 print:hidden"
    >
      <ChefHat size={18} />
      <span className="hidden sm:inline">Ask Sous Chef</span>
    </Link>
  )
}
