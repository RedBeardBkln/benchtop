import type { Tour } from './types'

// One tour per Settings tab. The tabs share a sub-nav (data-tour="settings-nav"); only the
// Profile tour points at it, since /settings opens on Profile.

export const settingsProfileTour: Tour = {
  id: 'settings-profile-v1',
  paths: ['/settings/profile'],
  steps: [
    {
      title: 'Welcome to Settings',
      body: 'This is where you manage your profile, preferences, account, team, billing and privacy. Here’s a quick look around.',
    },
    {
      target: 'settings-nav',
      title: 'Settings tabs',
      body: 'Switch between tabs here. Some only show for certain roles; for example, Team is just for owners and admins.',
    },
    {
      target: 'settings-profile-details',
      title: 'Your details',
      body: 'Add your name, company, job title, phone and time zone. They’re used on your account and in messages about it.',
    },
    {
      target: 'settings-profile-logo',
      title: 'Your company logo',
      body: 'Upload a logo to put it on formulation printouts, PDFs and time reports. Admins can apply it to the whole team.',
    },
  ],
}

export const settingsPreferencesTour: Tour = {
  id: 'settings-preferences-v1',
  paths: ['/settings/preferences'],
  steps: [
    {
      title: 'Make Benchtop yours',
      body: 'Preferences change how Benchtop looks and works just for you. Teammates choose their own.',
    },
    {
      target: 'settings-prefs-appearance',
      title: 'Light or dark',
      body: 'Pick light, dark or Auto to follow your device. It’s remembered in this browser, and printouts are always light.',
    },
    {
      target: 'settings-prefs-cogs',
      title: 'Show costs',
      body: 'Turn this on to add a COGS tab to formulations, with raw material cost per batch, per serving and per unit.',
    },
    {
      target: 'settings-prefs-time',
      title: 'Track billable time',
      body: 'Adds Time to the menu so you can log hours against clients and send them a time report.',
    },
    {
      target: 'settings-prefs-tours',
      title: 'Page tours',
      body: 'Turn automatic tours like this one on or off, or have every page’s tour show again.',
    },
  ],
}

export const settingsAccountTour: Tour = {
  id: 'settings-account-v1',
  paths: ['/settings/account'],
  steps: [
    {
      target: 'settings-account-workspace',
      title: 'Your account',
      body: 'Your account is the workspace your projects, ingredients and inventory live in. See your role here; the owner can rename it.',
    },
    {
      target: 'settings-account-email',
      title: 'Change your email',
      body: 'Enter a new sign-in email and we’ll send a confirmation link. The change takes effect once you click it.',
    },
    {
      target: 'settings-account-password',
      title: 'Update your password',
      body: 'Set a new password any time while you’re signed in. It works straight away.',
    },
    {
      target: 'settings-account-session',
      title: 'Sign out',
      body: 'Sign out here when you’re done, especially on a shared computer.',
    },
  ],
}

export const settingsTeamTour: Tour = {
  id: 'settings-team-v1',
  paths: ['/settings/team'],
  steps: [
    {
      target: 'settings-team-seats',
      title: 'Team seats',
      body: 'See how many people your plan covers and how extra teammates are billed.',
    },
    {
      target: 'settings-team-invite',
      title: 'Invite a teammate',
      body: 'Choose their role and, for members, which projects they can see. You get a link to send them yourself; nothing is emailed.',
    },
    {
      target: 'settings-team-members',
      title: 'Everyone on the team',
      body: 'Change what someone can see, or remove them. Their work stays in the account when they leave.',
    },
    {
      target: 'settings-team-transfer',
      title: 'Hand over the account',
      body: 'Leaving the company? Make another teammate the owner. You become an admin.',
    },
  ],
}

export const settingsBillingTour: Tour = {
  id: 'settings-billing-v1',
  paths: ['/settings/billing'],
  steps: [
    {
      target: 'settings-billing-subscription',
      title: 'Your subscription',
      body: 'Everything about your Benchtop plan lives here: one plan with every feature, billed monthly or annually.',
    },
    {
      target: 'settings-billing-status',
      title: 'Status at a glance',
      body: 'See whether you’re on a free trial or subscribed, and when it renews. Hover a label for what it means.',
    },
    {
      target: 'settings-billing-interval',
      title: 'Monthly or annual',
      body: 'Pick how often you’d like to be billed before you subscribe. Annual billing saves you money.',
    },
    {
      target: 'settings-billing-actions',
      title: 'Subscribe or manage',
      body: 'Subscribe through Stripe, or open Manage billing to change your card, download invoices or cancel. Benchtop never sees your card number.',
    },
  ],
}

export const settingsInvoicingConnectionTour: Tour = {
  id: 'settings-invoicing-connection-v1',
  paths: ['/settings/invoicing-connection'],
  steps: [
    {
      target: 'settings-connection-card',
      title: 'Connect your invoicing',
      body: 'Your invoicing app can read your unbilled time for a client, then mark it billed when the invoice goes out.',
    },
    {
      target: 'settings-connection-key',
      title: 'Your connection key',
      body: 'Make a key and paste it into your invoicing app. It’s shown only once; make a new one or revoke it any time.',
    },
  ],
}

export const settingsPrivacyTour: Tour = {
  id: 'settings-privacy-v1',
  paths: ['/settings/privacy'],
  steps: [
    {
      target: 'settings-privacy-terms',
      title: 'Terms and privacy',
      body: 'See which versions of the Terms and Privacy Policy you accepted and when, and read the current ones.',
    },
    {
      target: 'settings-privacy-export',
      title: 'Download your data',
      body: 'The owner can download everything in the account as one zip of Excel, Word, PDF and image files, or as JSON.',
    },
    {
      target: 'settings-privacy-delete',
      title: 'Delete the account',
      body: 'The owner can permanently delete the account and all its data. This can’t be undone, so download your data first.',
    },
  ],
}
