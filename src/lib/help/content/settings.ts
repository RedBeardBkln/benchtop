import type { HelpSection } from '../types'

export const settings: HelpSection = {
  slug: 'settings',
  title: 'Your profile & settings',
  icon: 'settings',
  intro:
    'How to update your name and contact details, add your company logo, turn on cost tracking, change your email or password, reset a forgotten password, accept updated terms, download your data, and delete an account.',
  articles: [
    {
      slug: 'settings-overview',
      title: 'What’s in Settings',
      summary: 'A map of the Settings tabs and who can use each one.',
      blocks: [
        {
          type: 'p',
          text: 'Click [Settings](/settings) in the menu. On a computer the tabs are listed down the left; on a phone they are a row you can swipe sideways.',
        },
        {
          type: 'terms',
          items: [
            { term: '[Profile](/settings/profile)', text: 'Your name, company, job title, phone, time zone and company logo. Everyone.' },
            { term: '[Preferences](/settings/preferences)', text: 'Personal choices, such as showing cost (COGS) on formulations or turning on billable time tracking. Everyone.' },
            { term: '[Account](/settings/account)', text: 'The account name, your sign-in email, your password, and signing out. Everyone (only the owner can rename the account).' },
            { term: '[Team](/settings/team)', text: 'Inviting people and choosing what they can see. Owners and admins only. See [Team & permissions](/help/team).' },
            { term: '[Billing](/settings/billing)', text: 'Your plan, trial dates and subscription. Everyone can look; only the owner can subscribe or make changes. See [Billing & plans](/help/billing).' },
            { term: '[Privacy & Terms](/settings/privacy)', text: 'Which Terms you accepted, downloading your data, and deleting the account.' },
          ],
        },
        {
          type: 'note',
          text: 'Settings always works, even when the account’s trial has ended or the subscription has lapsed. That way the owner can still subscribe, download data or close the account.',
        },
      ],
    },
    {
      slug: 'profile',
      title: 'Updating your profile',
      summary: 'Change your name, company, job title, phone number and time zone.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Go to [Settings → Profile](/settings/profile).',
            'Edit any of the fields. **Full name** is required. **Company**, **Job title**, **Phone** and **Time zone** are optional.',
            'For **Time zone**, click **Use mine** to fill in your device’s time zone automatically, or type one like `America/New_York`.',
            'Click `Save changes`. You’ll see “Profile saved”.',
          ],
        },
        {
          type: 'terms',
          items: [
            { term: 'Email', text: 'Shown but grayed out here. Change it on the [Account](/settings/account) tab instead.' },
            { term: 'Full name', text: 'What your teammates see on the Team list. Having one also unlocks the **Report a bug or request a feature** link.' },
            { term: 'Phone', text: 'Digits, spaces and + ( ) . - only. It pre-fills the feedback form.' },
          ],
        },
      ],
    },
    {
      slug: 'company-logo',
      title: 'Adding your company logo',
      summary: 'Put your logo on formulation printouts, PDFs and time reports, for you or your whole team.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Go to [Settings → Profile](/settings/profile) and find **Company logo**.',
            'Click `Upload logo` and choose a PNG, JPEG or WEBP image of up to 2 MB. You’ll see “Logo saved” and a preview.',
            'To change it, click `Replace logo`. To take it off your documents, click `Remove`.',
          ],
        },
        {
          type: 'p',
          text: 'Your logo appears at the top of a formulation’s print view (and the PDF you save from it), at the top of a formulation page you print directly, and on time reports.',
        },
        {
          type: 'p',
          text: '**Owners and admins** can put their logo on everyone’s documents. Upload your own logo, then click `Use my logo for the whole team` under **Team logo**. While a team logo is applied it replaces each member’s own logo. Click `Stop using team logo` to go back to each person’s own.',
        },
        {
          type: 'note',
          text: 'A wide logo on a transparent or white background prints best. The Nutrition Facts panel never shows a logo, because it has to follow the FDA format.',
        },
      ],
    },
    {
      slug: 'preferences',
      title: 'Preferences: turning on cost (COGS)',
      summary: 'Show or hide the COGS tab on formulations, just for you.',
      blocks: [
        {
          type: 'p',
          text: '**COGS** means “cost of goods sold”. In Benchtop it means the raw material cost of a recipe: what the ingredients in a batch, a kilogram, a serving or a package cost you. It is off by default so people who don’t deal with costs never see it.',
        },
        {
          type: 'steps',
          items: [
            'Go to [Settings → Preferences](/settings/preferences).',
            'Turn on **Show COGS on formulations**. It saves straight away; there is no Save button.',
            'Open any formulation. You’ll now see two tabs above the recipe: **Formula** and **COGS**.',
          ],
        },
        {
          type: 'note',
          text: 'This setting is only for you. Each teammate turns it on for themselves. You can record ingredient costs whether this is on or off. To learn how costs work, see [Raw material cost (COGS)](/help/formulations#cogs).',
        },
        {
          type: 'tip',
          text: 'Preferences is also where you turn on **Track billable time**, which adds Time to the menu. See [Billable time](/help/time#turn-on).',
        },
      ],
    },
    {
      slug: 'change-email-password',
      title: 'Changing your sign-in email or password',
      summary: 'Do it from Settings → Account while you are signed in.',
      blocks: [
        { type: 'h', text: 'Change your password' },
        {
          type: 'steps',
          items: [
            'Go to [Settings → Account](/settings/account) and find the **Password** card.',
            'Type a **New password** (at least 8 characters) and type it again in **Confirm new password**.',
            'Click `Update password`. You’ll see “Password updated”. You don’t need your old password.',
          ],
        },
        { type: 'h', text: 'Change your sign-in email' },
        {
          type: 'steps',
          items: [
            'Go to [Settings → Account](/settings/account) and find the **Sign-in email** card.',
            'Type your **New email** and click `Change email`.',
            'Open your new inbox and click the confirmation link Benchtop sent. Your sign-in email changes only after you click it. Until then, keep signing in with your old email.',
          ],
        },
        {
          type: 'tip',
          text: 'Don’t see the confirmation email? Check your spam or junk folder. It comes from Benchtop <noreply@benchtop.solutions>. Depending on security settings, a link may also be sent to your old address; if so, click both.',
        },
      ],
    },
    {
      slug: 'reset-password',
      title: 'Resetting a forgotten password',
      summary: 'Get a reset link by email when you can’t sign in.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On the [sign-in page](/login), click **Forgot password?** next to the Password label (or go straight to [Reset password](/forgot-password)).',
            'Type your email and click `Send reset link`. You’ll see “Check your email”.',
            'Open the email from Benchtop **on the same device and in the same browser** you used to ask for it, and click the link.',
            'On **Set new password**, type your new password twice (at least 8 characters) and click `Update password`.',
            'You’ll see “Password updated — please sign in”.',
          ],
        },
        {
          type: 'warning',
          text: 'Reset links work **once** and only in the **browser you requested them from**. A very common mistake is asking for the link on your computer and opening the email on your phone. If you see “That reset link has expired or was already used”, ask for a new link from the device where you read your email.',
        },
      ],
    },
    {
      slug: 'account-name',
      title: 'Renaming your account',
      summary: 'The owner can change the company name people see.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Go to [Settings → Account](/settings/account).',
            'In the **Account** card, change **Account name**.',
            'Click `Save name`. You’ll see “Account name saved”.',
          ],
        },
        {
          type: 'p',
          text: 'Only the account owner can do this. Everyone else sees the field grayed out. The account name is what invited people see (“You have been invited to join the … team”). The same card also shows your role, when the account was created, and its ID, which is useful if you contact support.',
        },
      ],
    },
    {
      slug: 'accept-terms',
      title: 'Accepting updated Terms and Privacy Policy',
      summary: 'Why Benchtop sometimes asks you to agree again before continuing.',
      blocks: [
        {
          type: 'p',
          text: 'When the Terms of Service or Privacy Policy change, everyone on the account (not just the owner) is asked to accept the new version before using Benchtop again.',
        },
        {
          type: 'steps',
          items: [
            'You’ll see a page titled **We have updated our Terms and Privacy Policy** (or **Before you continue**).',
            'Read the documents if you like; the links open in a new tab.',
            'Tick **I have read and agree to the Terms of Service and the Privacy Policy**.',
            'Click `Accept and continue`.',
          ],
        },
        {
          type: 'p',
          text: 'To see which version you accepted and when, go to [Settings → Privacy & Terms](/settings/privacy). You can read the current [Terms](/legal/terms) and [Privacy Policy](/legal/privacy) at any time.',
        },
      ],
    },
    {
      slug: 'download-data',
      title: 'Downloading all your data',
      summary: 'The owner can download a full copy of everything in the account as Excel, Word, PDF and image files.',
      blocks: [
        {
          type: 'steps',
          items: [
            'The account owner goes to [Settings → Privacy & Terms](/settings/privacy).',
            'In the **Your data** card, click `Download my data`.',
            'Choose a format for each part, or keep the defaults: projects and clients, formulations, and suppliers and ingredients as **Excel**; Sous Chef and Nutrition Facts panels as **PDF**.',
            'Click `Export`. Building the file can take a minute; the dialog shows its progress.',
            'A file named like `Benchtop export 2026-11-11.zip` downloads to your computer.',
          ],
        },
        {
          type: 'p',
          text: 'The zip holds a **README** listing what is inside, and these parts, each in the format you chose:',
        },
        {
          type: 'list',
          items: [
            '**Projects and clients** (Excel, Word or PDF): every project with its nutrition targets, every client with contacts, accounting and shipping details, all time entries, and the team list.',
            '**Formulations** (Excel, Word or PDF): one file per formulation. In Excel each iteration has its own tab; in Word and PDF its own section. Each holds the ingredients (with costs, and any added after a process step), process steps, calculated nutrition, saved panels, targets, notes and the production log.',
            '**Suppliers and ingredients** (Excel, Word or PDF): suppliers and their contacts, the ingredients each supplies, every ingredient with its nutrient values, allergens, certifications and costs, equipment and lab intake.',
            '**Sous Chef** (PDF or Word): your own conversations (other people’s are private to them) and the team lab notebook.',
            '**Nutrition Facts panels** (PDF, JPEG or PNG): every saved panel as you saved it, and a standard panel for each iteration that has nutrient data but no saved panel.',
            '**Ingredient documents**: the spec sheets and COAs you uploaded, in their original format.',
          ],
        },
        {
          type: 'p',
          text: 'For importing into other software, `Download as JSON` downloads the whole account as one JSON file instead. It lists uploaded documents but doesn’t include the files.',
        },
        {
          type: 'note',
          text: 'Exporting works even if the subscription has ended.',
        },
      ],
    },
    {
      slug: 'delete-account',
      title: 'Deleting the account',
      summary: 'Permanently close the account. Owner only, and it cannot be undone.',
      blocks: [
        {
          type: 'warning',
          text: 'Deleting is permanent. It removes **all** of the account’s data and documents, deletes **every teammate’s login** as well as yours, and **cancels the subscription immediately**. Download your data first.',
        },
        {
          type: 'steps',
          items: [
            'The owner goes to [Settings → Privacy & Terms](/settings/privacy).',
            'In the red **Delete account** card, type your sign-in email in the box to confirm.',
            'Click `Delete my account`, then confirm the pop-up.',
            'You’re signed out and taken to the sign-in page.',
          ],
        },
        {
          type: 'p',
          text: 'If anything goes wrong partway (for example the subscription can’t be canceled), nothing is deleted and you’ll see a message explaining why. Fees already paid are not refunded, except where the law requires it.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'How do I change my password?',
      a: 'Go to [Settings → Account](/settings/account), type your new password twice in the **Password** card, and click `Update password`. If you can’t sign in, use [Resetting a forgotten password](/help/settings#reset-password).',
    },
    {
      q: 'I clicked the reset link but it says it expired or was already used.',
      a: 'Reset links only work once, and only in the same browser where you asked for them. Go to [Reset password](/forgot-password) on the device you read your email on, ask for a new link, and open it there.',
    },
    {
      q: 'What are the password rules?',
      a: 'At least 8 characters and no more than 128. There are no other rules, but a longer password is safer.',
    },
    {
      q: 'I changed my email but I still sign in with the old one. Why?',
      a: 'The change only takes effect after you click the confirmation link sent to your new address. Check that inbox, including spam.',
    },
    {
      q: 'How do I turn on cost (COGS)?',
      a: 'Go to [Settings → Preferences](/settings/preferences) and turn on **Show COGS on formulations**. Formulations will then show a **COGS** tab.',
    },
    {
      q: 'I turned on COGS. Why can’t my teammate see it?',
      a: 'The COGS setting is personal. Each person turns it on in their own Preferences.',
    },
    {
      q: 'What does “Use mine” next to Time zone do?',
      a: 'It fills in the time zone your device is set to, so you don’t have to type it.',
    },
    {
      q: 'Why can’t I rename the account?',
      a: 'Only the account owner can rename it. Ask your owner to change it in [Settings → Account](/settings/account).',
    },
    {
      q: 'Why am I being asked to accept the Terms again?',
      a: 'The Terms of Service or Privacy Policy was updated. Every user accepts the new version once. Tick the box and click `Accept and continue`.',
    },
    {
      q: 'How do I download a copy of all our data?',
      a: 'The owner goes to [Settings → Privacy & Terms](/settings/privacy) and clicks `Download my data`. Uploaded documents aren’t included, only a list of them.',
    },
    {
      q: 'Can I delete just my own login?',
      a: 'Not yourself. Ask an owner or admin to remove you on the [Team](/settings/team) page; that deletes your login.',
    },
    {
      q: 'Can deleting the account be undone?',
      a: 'No. Everything is removed permanently, including every teammate’s login. Download your data first.',
    },
    {
      q: 'Where can I read the Terms of Service and Privacy Policy?',
      a: 'Any time at [Terms of Service](/legal/terms) and [Privacy Policy](/legal/privacy). [Settings → Privacy & Terms](/settings/privacy) shows which versions you accepted.',
    },
  ],
}
