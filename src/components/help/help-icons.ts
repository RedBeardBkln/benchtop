import {
  Building2, Clock, CreditCard, FlaskConical, FolderOpen, HelpCircle, Rocket, Settings, TestTube2, Truck, Users,
} from 'lucide-react'
import type { HelpIcon } from '@/lib/help/types'

// Shared by server pages and client components, so it lives outside any 'use client' module
export const HELP_ICONS: Record<HelpIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  rocket: Rocket,
  folder: FolderOpen,
  flask: FlaskConical,
  beaker: TestTube2,
  truck: Truck,
  building: Building2,
  users: Users,
  settings: Settings,
  card: CreditCard,
  clock: Clock,
  help: HelpCircle,
}
