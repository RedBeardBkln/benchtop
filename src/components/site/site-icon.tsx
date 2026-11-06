import { ChefHat, Clock, Coins, Factory, FlaskConical, Library, ShieldCheck, Smartphone, Tag, Target, Upload, Users, type LucideIcon } from 'lucide-react'
import type { SiteIcon as SiteIconName } from '@/lib/site-content'

const ICONS: Record<SiteIconName, LucideIcon> = {
  flask: FlaskConical,
  label: Tag,
  library: Library,
  chef: ChefHat,
  coins: Coins,
  factory: Factory,
  users: Users,
  clock: Clock,
  target: Target,
  upload: Upload,
  phone: Smartphone,
  shield: ShieldCheck,
}

// A feature icon on a small lime keycap tile
export function SiteIcon({ name }: { name: SiteIconName }) {
  const Icon = ICONS[name]
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-ink-900 bg-lcd-300 text-ink-900 shadow-[2px_2px_0_var(--color-ink-900)]">
      <Icon size={20} strokeWidth={1.75} />
    </span>
  )
}
