import type { HelpSection } from '../types'

export const gettingStarted: HelpSection = {
  slug: 'getting-started',
  title: 'Getting started',
  icon: 'rocket',
  intro:
    'New to benchtop? Start here. This explains what benchtop does, how to get in, how the screens are laid out, and the usual order people work in.',
  articles: [
    {
      slug: 'what-is-benchtop',
      title: 'What benchtop is for',
      summary: 'A quick tour of the big ideas, in plain words.',
      blocks: [
        {
          type: 'p',
          text: 'benchtop is a workspace for creating food and supplement recipes (we call them **formulations**). It keeps track of your ingredients, works out the nutrition for you, builds the Nutrition Facts panel and ingredient statement for a label, and helps you keep versions of a recipe as you improve it.',
        },
        { type: 'p', text: 'Here are the main pieces and how they fit together:' },
        {
          type: 'terms',
          items: [
            { term: 'Account (workspace)', text: 'Your company’s private space. Everything you create lives here, and nobody outside your account can see it.' },
            { term: 'Ingredients', text: 'Your ingredient library: every raw material you use, with its nutrition, allergens, certifications, suppliers and cost. See [Ingredients](/help/ingredients).' },
            { term: 'Suppliers', text: 'The companies you buy ingredients from, with their contacts and prices. See [Suppliers](/help/suppliers).' },
            { term: 'Projects', text: 'A folder for one product idea, such as “High-protein granola bar”. A project holds that product’s formulations and its nutrition targets. See [Projects](/help/projects).' },
            { term: 'Formulations', text: 'The actual recipes inside a project. Each one lists ingredients and amounts, and benchtop works out the totals, nutrition and label text. See [Formulations](/help/formulations).' },
            { term: 'Clients', text: 'If you develop products for other companies, a client record holds that customer’s details and links to their projects. Only owners and admins see Clients. See [Clients](/help/clients).' },
          ],
        },
        {
          type: 'tip',
          text: 'A good first day: add a handful of ingredients, create a project, then build your first formulation inside it. The guide [Your first formulation, start to finish](#first-formulation) walks you through it.',
        },
      ],
    },
    {
      slug: 'getting-access',
      title: 'Getting access: invitations and creating your login',
      summary: 'benchtop is invitation only. Here is how to use the link you were sent.',
      blocks: [
        {
          type: 'p',
          text: 'You cannot sign up on your own. Every login starts with a personal **invitation link**. If you are joining an existing team, the team’s owner or an admin creates the link. If you are starting a brand-new company account, the benchtop team creates it.',
        },
        {
          type: 'note',
          text: 'benchtop does not email invitation links itself. The person who invited you copies the link and sends it to you by email, chat or text. If you can’t find it, ask them to send it again.',
        },
        { type: 'h', text: 'Creating your login' },
        {
          type: 'steps',
          items: [
            'Open the invitation link. You will see a page titled **Join benchtop**.',
            'Check that the **Email** shown is yours. It is greyed out because the invitation only works for that address.',
            'Type your **Full name**. If you are creating a new company account, you can also type a **Company (optional)**. That becomes your account’s name (if you leave it blank, your name is used).',
            'Choose a **Password** of at least 8 characters, and type it again in **Confirm password**.',
            'Tick **I agree to the Terms of Service and Privacy Policy**. You can open either document first; they open in a new tab.',
            'Click `Create account`. You are signed in straight away. Team members land on **Projects**. New company accounts land on **Settings → Billing**, where you can see your free trial or free period.',
          ],
        },
        { type: 'h', text: 'Things that can go wrong' },
        {
          type: 'terms',
          items: [
            { term: '“This invitation has expired”', text: 'Invitation links only last a limited time (7 days for team invitations). Ask for a new one.' },
            { term: '“This invitation has already been used”', text: 'Links work once. If you already created your login, just [sign in](/login).' },
            { term: '“This invitation has been withdrawn”', text: 'The person who invited you cancelled it. Ask them for a new one.' },
            { term: '“An account with this email already exists”', text: 'This email already has a benchtop login. Each email can belong to only one account, so sign in instead, or ask to be invited with a different email.' },
            { term: '“This team has reached its user limit”', text: 'The team’s plan allows a set number of people and it is full. Contact the person who invited you.' },
          ],
        },
        {
          type: 'note',
          text: 'Your free trial or free period starts on the day you create your login, not the day the invitation was sent.',
        },
      ],
    },
    {
      slug: 'signing-in',
      title: 'Signing in and out',
      summary: 'How to sign in, what happens if you forget your password, and how to sign out.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Go to the [sign-in page](/login).',
            'Type your **Email** and **Password**.',
            'Click `Sign in`. You go to the page you were trying to open, or to **Projects**.',
          ],
        },
        {
          type: 'p',
          text: 'If benchtop says your email or password is wrong, check for typos and Caps Lock, then try again. If you have forgotten your password, follow [Resetting a forgotten password](/help/settings#reset-password).',
        },
        { type: 'h', text: 'Signing out' },
        {
          type: 'list',
          items: [
            'On a computer: click **Sign out** at the bottom of the dark menu on the left, under your email address.',
            'On a phone: tap **Sign out** at the right end of the menu bar along the bottom of the screen.',
            'Or go to [Settings → Account](/settings/account) and use the **Session** card.',
          ],
        },
        {
          type: 'note',
          text: 'There is no “Sign up” button, no “Sign in with Google”, and no two-step verification. You sign in with your email and password only.',
        },
      ],
    },
    {
      slug: 'finding-your-way',
      title: 'Finding your way around the screen',
      summary: 'Where the menu is on a computer and on a phone, and what each item opens.',
      blocks: [
        {
          type: 'p',
          text: '**On a computer** (or any wide screen) the menu is the dark bar down the left side. **On a phone** the same menu is a bar along the bottom of the screen with an icon and a short label for each item.',
        },
        {
          type: 'terms',
          items: [
            { term: '[Projects](/projects)', text: 'All your product projects. This is the home page after you sign in.' },
            { term: '[Clients](/clients)', text: 'Customer records. Only shown to owners and admins.' },
            { term: '[Ingredients](/ingredients)', text: 'Your ingredient library.' },
            { term: '[Suppliers](/suppliers)', text: 'The companies you buy from.' },
            { term: '[Settings](/settings)', text: 'Your profile, preferences, account, team, billing and privacy.' },
            { term: '[Help](/help)', text: 'These guides.' },
          ],
        },
        {
          type: 'p',
          text: 'The menu item for the page you are on is highlighted. At the very bottom of every page there are two small links: **Help & FAQ**, and **Report a bug or request a feature**.',
        },
        {
          type: 'p',
          text: 'Small pop-up messages (for example “Profile saved” or an error) appear for a few seconds in the **top-right corner** of the screen.',
        },
        { type: 'h', text: 'Quick explanations as you go' },
        {
          type: 'list',
          items: [
            '**Hover over a button** (or move to it with the Tab key) to see what it does.',
            'Words with a **dotted underline**, such as Yield or On hand, are benchtop terms. Hover over one, or **tap it** on a phone or tablet, to see what it means.',
            'Press **Esc**, or tap anywhere else, to close an explanation.',
          ],
        },
      ],
    },
    {
      slug: 'first-formulation',
      title: 'Your first formulation, start to finish',
      summary: 'The usual order of work, with links to the detailed guide for each step.',
      blocks: [
        {
          type: 'steps',
          items: [
            '**Fill out your profile.** Go to [Settings → Profile](/settings/profile) and add your full name. (This also turns on the feedback link at the bottom of each page.)',
            '**Add your ingredients.** Go to [Ingredients](/ingredients) and add the raw materials you plan to use. You can type them in, look them up in the USDA database, or read them from a photo of a spec sheet. See [Ingredients](/help/ingredients).',
            '**Add suppliers (optional).** If you want to track who sells each ingredient and at what price, add them under [Suppliers](/suppliers). See [Suppliers](/help/suppliers).',
            '**Create a project.** Go to [Projects](/projects) and create a project for the product. See [Projects](/help/projects).',
            '**Set targets (optional).** In the project, set the nutrition goals the product must hit, such as “at least 10 g protein per serving”. benchtop will check every formulation against them.',
            '**Create a formulation.** Inside the project, create a formulation, set the batch and serving size, and add ingredients with their amounts. See [Formulations](/help/formulations).',
            '**Check the results.** Look at the nutrition totals, the Nutrition Facts panel, the ingredient statement and allergens. Adjust amounts until you are happy.',
            '**Save versions as you go.** When you want to try a change without losing what you have, make a new iteration (version) of the formulation.',
            '**Print or share.** Print the formulation sheet for the lab or production.',
          ],
        },
      ],
    },
    {
      slug: 'install-app',
      title: 'Putting benchtop on your phone or desktop like an app',
      summary: 'Add benchtop to your home screen or dock so it opens in its own window.',
      blocks: [
        {
          type: 'p',
          text: 'benchtop is a website, but you can “install” it so it gets its own icon and opens in its own window without the browser’s address bar. There is no app store download; you do it from your browser.',
        },
        {
          type: 'terms',
          items: [
            { term: 'iPhone or iPad (Safari)', text: 'Open benchtop in Safari, tap the **Share** button (the square with an arrow pointing up), then tap **Add to Home Screen**, then **Add**.' },
            { term: 'Android (Chrome)', text: 'Open benchtop in Chrome, tap the **⋮** menu in the top-right corner, then tap **Install app** or **Add to Home screen**.' },
            { term: 'Computer (Chrome or Edge)', text: 'Look for the small install icon at the right end of the address bar and click it, or open the browser menu and choose the option to install benchtop as an app.' },
          ],
        },
        {
          type: 'note',
          text: 'The installed app still needs an internet connection; it does not work offline. It updates itself automatically, so you never need to reinstall it. The exact wording of the browser menus can differ slightly between browsers and versions.',
        },
      ],
    },
    {
      slug: 'getting-more-help',
      title: 'Getting more help, reporting a bug, or asking for a feature',
      summary: 'Use the link at the bottom of any page to reach the benchtop team.',
      blocks: [
        {
          type: 'p',
          text: 'First, try the search box at the top of this Help page. If you still need help, or something isn’t working, tell us directly from inside benchtop.',
        },
        {
          type: 'steps',
          items: [
            'Scroll to the very bottom of any page and click **Report a bug or request a feature**.',
            'Choose `Bug report` (something is broken) or `Feature request` (something you wish benchtop did).',
            'Describe it in the big box. For a bug, say what you did, what you expected, and what happened instead. The more detail, the faster we can fix it.',
            'Check your **Name**, **Email** and **Phone**. They are filled in from your profile, and you can change them here.',
            'Tick **Contact me about this submission** if you would like us to get back to you.',
            'Click `Send`. You will see “Thanks, your bug report was sent”.',
          ],
        },
        {
          type: 'note',
          text: 'The link only appears once your profile has a full name, so we always know who to reply to. If you don’t see it, add your name in [Settings → Profile](/settings/profile) and click `Save changes`. benchtop also records which page you were on and which browser you use, to help us find the problem.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'What do the words with a dotted underline mean?',
      a: 'They’re benchtop terms. Hover over one with the mouse, or tap it on a phone or tablet, and a short explanation pops up. Hovering over a button explains what it does.',
    },
    {
      q: 'How do I sign up for benchtop?',
      a: 'You can’t sign up on your own; benchtop is invitation only. To join your company’s existing account, ask its owner or an admin for an invitation link. To start a new company account, contact the benchtop team.',
    },
    {
      q: 'I never got an invitation email. Where is it?',
      a: 'benchtop doesn’t send invitation emails. The person who invited you copies the link and sends it to you themselves. Ask them to send it again. If they no longer have it, they can cancel the old invitation and create a new one (see [Inviting a teammate](/help/team#invite)).',
    },
    {
      q: 'My invitation link says it has expired. What do I do?',
      a: 'Ask the person who invited you for a new link. Team invitations last 7 days.',
    },
    {
      q: 'Can I use one login for two different companies?',
      a: 'No. Each email address can have one login, and that login belongs to one account. To work in two accounts, use a different email address for the second one.',
    },
    {
      q: 'Where is the menu on my phone?',
      a: 'On a phone the menu is the dark bar along the bottom of the screen: Projects, Clients (owners and admins only), Ingredients, Suppliers, Settings, Help and Sign out.',
    },
    {
      q: 'What does “No account found” mean?',
      a: 'You are signed in, but your login isn’t connected to any benchtop account. This usually means you were removed from the team or the account was deleted. You’ll need a new invitation from your team’s owner or an admin.',
    },
    {
      q: 'Does benchtop work offline?',
      a: 'No. benchtop needs an internet connection, even when you install it on your phone or computer.',
    },
    {
      q: 'Which browsers can I use?',
      a: 'Use an up-to-date version of Chrome, Edge, Safari or Firefox on a computer, tablet or phone. Big tables such as the formulation editor are easiest to use on a computer.',
    },
    {
      q: 'Why don’t I see the “Report a bug or request a feature” link?',
      a: 'It only appears once your profile has a full name. Go to [Settings → Profile](/settings/profile), enter your full name and click `Save changes`.',
    },
    {
      q: 'Is my data private?',
      a: 'Yes. Each account is completely separate, and no other company can see your data. benchtop will never sell your data or your clients’ data, and won’t share it unless the law requires it. Read the full [Privacy Policy](/legal/privacy).',
    },
  ],
}
