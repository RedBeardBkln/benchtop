import type { HelpSection } from '../types'

export const billing: HelpSection = {
  slug: 'billing',
  title: 'Billing & plans',
  icon: 'card',
  intro:
    'Prices, free trials, how to subscribe, how to change your card or cancel, and what happens if a trial or subscription ends. Only the account owner can make billing changes.',
  articles: [
    {
      slug: 'plans',
      title: 'Plans and prices',
      summary: 'One plan with every feature, paid monthly or yearly.',
      blocks: [
        {
          type: 'terms',
          items: [
            { term: 'Monthly', text: '**$25 per month.** Extra team members are $10 per month each.' },
            { term: 'Annual', text: '**$250 per year** (saves $50 a year). Extra team members are $100 per year each.' },
          ],
        },
        { type: 'p', text: 'Every plan includes all features. Your account will be one of these types, set when it was created:' },
        {
          type: 'terms',
          items: [
            { term: 'Paid subscriber', text: 'Starts with a **60-day free trial**. After that, a subscription is needed.' },
            { term: 'Free for a set time', text: 'Free for a set number of days from sign-up, then a subscription is needed.' },
            { term: 'Free for life', text: 'Never needs a subscription. Some of these plans have a limit on how many extra people can join.' },
          ],
        },
        {
          type: 'p',
          text: 'Go to [Settings → Billing](/settings/billing) to see which one you have and when any free period ends. To change your account type, contact the benchtop team.',
        },
      ],
    },
    {
      slug: 'subscribe',
      title: 'Subscribing',
      summary: 'The owner starts a subscription from Settings → Billing.',
      blocks: [
        {
          type: 'steps',
          items: [
            'The account owner goes to [Settings → Billing](/settings/billing).',
            'Choose **Monthly · $25/month** or **Annual · $250/year**.',
            'Click `Subscribe` (or `Resubscribe` if you had one before).',
            'You’re taken to Stripe, our secure payment provider. Enter your card details there and confirm. benchtop never sees your card number.',
            'You come back to the Billing page. It shows “Confirming your payment…” for a moment, then your status changes to **Active**.',
          ],
        },
        {
          type: 'tip',
          text: 'You can subscribe any time during your free trial or free period. You won’t be charged until it ends, so you don’t lose free days by subscribing early (unless it ends within about 2 days).',
        },
        {
          type: 'p',
          text: 'Anyone already on your team is added to the subscription as a seat automatically. If you leave Stripe’s page without paying, you’ll see “Checkout was cancelled. You have not been charged.”',
        },
      ],
    },
    {
      slug: 'manage',
      title: 'Changing your card, viewing invoices, or cancelling',
      summary: 'Use Manage billing to open Stripe’s billing page.',
      blocks: [
        {
          type: 'steps',
          items: [
            'The owner goes to [Settings → Billing](/settings/billing).',
            'Click `Manage billing`. Stripe’s billing page opens.',
            'From there you can update your payment card, see and download invoices, or cancel.',
            'When you’re done, use the link on Stripe’s page to return to benchtop.',
          ],
        },
        {
          type: 'p',
          text: 'If you cancel, you keep full access until the end of the period you’ve paid for. The Billing page shows “Your subscription is set to cancel on …” and **Access until** that date. Fees already paid are not refunded, except where the law requires it.',
        },
        { type: 'h', text: 'Switching between monthly and annual' },
        {
          type: 'steps',
          items: [
            'Open [Settings → Billing](/settings/billing). The **Plan** line shows whether you’re billed monthly or annually.',
            'Click **Switch to annual billing** (or **Switch to monthly billing**).',
            'Read the summary and click `Switch to annual` (or `Switch to monthly`).',
          ],
        },
        {
          type: 'p',
          text: 'You’re charged for the new period straight away, less a credit for the unused part of the current one, and your renewal date moves to a year (or a month) from today. Extra team members switch to the matching price. During a free trial nothing is charged until the trial ends. Only the account owner can switch.',
        },
      ],
    },
    {
      slug: 'status',
      title: 'Reading the Billing page',
      summary: 'What each status means.',
      blocks: [
        {
          type: 'terms',
          items: [
            { term: 'Free trial / Free period', text: 'You’re in your free time. The page shows the end date.' },
            { term: 'Active', text: 'You’re subscribed and paid up. The page shows when it renews.' },
            { term: 'Trial', text: 'You’ve subscribed, but the first charge waits until your free time ends.' },
            { term: 'Payment past due', text: 'Your last payment failed. You still have access while Stripe tries again, but the owner should update the card under `Manage billing`.' },
            { term: 'Canceled, Unpaid, Incomplete, Expired, Paused', text: 'The subscription isn’t active, so most of benchtop is locked until the owner subscribes again.' },
            { term: 'No subscription', text: 'No free time is left and nobody has subscribed.' },
          ],
        },
      ],
    },
    {
      slug: 'locked',
      title: 'When a trial or subscription ends',
      summary: 'What still works, and how to get back in.',
      blocks: [
        {
          type: 'p',
          text: 'If the account has no free time left and no active subscription, every page except Settings sends you to the Billing page with “A subscription is required to use benchtop.”',
        },
        {
          type: 'list',
          items: [
            '**Your data is safe.** Nothing is deleted. Subscribing again brings everything back exactly as it was.',
            '**Settings still works** for everyone: profile, password, preferences, and so on.',
            'The **owner** can subscribe, download all the data, or delete the account.',
            'Admins can still manage the team, but can’t invite new people.',
            '**Only the owner can subscribe.** If you’re an admin or member, ask your owner.',
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'How much does benchtop cost?',
      a: '$25 a month or $250 a year, which includes the owner. Each extra person is $10 a month or $100 a year. New paid accounts start with a 60-day free trial.',
    },
    {
      q: 'If I subscribe during my free trial, am I charged right away?',
      a: 'No. The first charge happens when your trial or free period ends (unless it ends within about 2 days).',
    },
    {
      q: 'How do I change my credit card?',
      a: 'The owner goes to [Settings → Billing](/settings/billing), clicks `Manage billing`, and updates the card on Stripe’s page.',
    },
    {
      q: 'How do I get an invoice or receipt?',
      a: 'The owner clicks `Manage billing` on [Settings → Billing](/settings/billing). Stripe’s page lists your invoices to view and download.',
    },
    {
      q: 'How do I cancel?',
      a: 'The owner clicks `Manage billing` on [Settings → Billing](/settings/billing) and cancels on Stripe’s page. You keep access until the end of the period you’ve paid for.',
    },
    {
      q: 'My trial ended. Is my data gone?',
      a: 'No. Your data is kept. Once the owner subscribes, everything is back.',
    },
    {
      q: 'I’m not the owner and we’re locked out. What can I do?',
      a: 'Only the owner can subscribe. Ask them to go to [Settings → Billing](/settings/billing).',
    },
    {
      q: 'My payment failed. Am I locked out?',
      a: 'Not straight away. The status shows “Payment past due” and you keep access while Stripe retries. The owner should update the card under `Manage billing`.',
    },
    {
      q: 'Why can’t I see the Subscribe button?',
      a: 'Only the account owner can subscribe or change billing. Everyone else sees the status only.',
    },
    {
      q: 'Can I get a refund?',
      a: 'Fees already paid are non-refundable, except where the law requires otherwise. If you cancel, you keep access until the end of the period you paid for.',
    },
    {
      q: 'Can I switch from monthly to yearly?',
      a: 'Yes. On [Settings → Billing](/settings/billing), click **Switch to annual billing**, then confirm. You’re charged for the year straight away, less a credit for what’s left of your current month. Switching back works the same way.',
    },
    {
      q: 'Is my card information stored by benchtop?',
      a: 'No. Payments are handled by Stripe, and your card details go straight to them.',
    },
  ],
}
