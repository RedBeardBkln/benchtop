import type { Tour } from './types'

export const sousChefTour: Tour = {
  id: 'sous-chef-v1',
  paths: ['/sous-chef'],
  steps: [
    {
      title: 'Meet Sous Chef',
      body: 'Your product-development sidekick. Ask about food science, ingredient swaps or hitting a target. It reads your projects and formulations but never changes them.',
    },
    {
      target: 'souschef-starters',
      title: 'Not sure where to start?',
      body: 'Click one of these to ask it straight away, or use them as a model for your own questions.',
    },
    {
      target: 'souschef-composer',
      title: 'Ask anything',
      body: 'Type a question and press Enter. Be specific about your target, like protein per serving or cost per kg, for a sharper answer.',
    },
    {
      target: 'souschef-conversations',
      title: 'Your conversations',
      body: 'Every conversation is saved here and private to you. Pick one up where you left off, or start a new one.',
    },
    {
      target: 'souschef-notebook',
      title: 'The lab notebook',
      body: 'Sous Chef records the team’s decisions, preferences and bench results here, and applies them in every later conversation. You can add, edit or retire notes too.',
    },
  ],
}
