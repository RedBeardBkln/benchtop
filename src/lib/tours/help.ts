import type { Tour } from './types'

export const helpTour: Tour = {
  id: 'help-v1',
  paths: ['/help'],
  steps: [
    {
      target: 'help-search',
      title: 'Search for answers',
      body: 'Type a few words, like “print a label”, to search every guide and question. Results take you straight to the answer.',
    },
    {
      target: 'help-sections',
      title: 'Browse by topic',
      body: 'Each topic has step-by-step guides and common questions. Pick one to read through it.',
    },
    {
      target: 'help-nav',
      title: 'Jump between topics',
      body: 'This list stays beside every help page, so you can move to another topic any time.',
    },
    {
      target: 'help-popular',
      title: 'Popular questions',
      body: 'The questions people ask most, one click away.',
    },
    {
      target: 'help-feedback',
      title: 'Still stuck?',
      body: 'Use “Report a bug or request a feature” at the bottom of any page and the Benchtop team will help.',
    },
  ],
}

export const helpSectionTour: Tour = {
  id: 'help-section-v1',
  paths: ['/help/:section'],
  steps: [
    {
      target: 'help-section-intro',
      title: 'A help topic',
      body: 'Each topic starts with a short overview of what it covers.',
    },
    {
      target: 'help-section-toc',
      title: 'On this page',
      body: 'Every guide in this topic is listed here. Click one to jump straight to it.',
    },
    {
      target: 'help-section-article',
      title: 'Step-by-step guides',
      body: 'Each guide walks you through one task. Hover its title for a link you can share.',
    },
    {
      target: 'help-section-faq',
      title: 'Common questions',
      body: 'Quick answers sit at the end of each topic. Click a question to open its answer.',
    },
    {
      target: 'help-search',
      title: 'Search any time',
      body: 'Looking for something else? Search every topic from the box at the top.',
    },
  ],
}
