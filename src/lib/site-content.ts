import { PLAN_PRICE_USD, SEAT_PRICE_USD } from '@/lib/billing/seats'
import { PAID_TRIAL_DAYS } from '@/lib/billing/plans'

// Copy for the public site. Prices and the trial length come from the billing rules, so the site
// can't drift from what Stripe charges. Feature claims should match the Help center.

export type SiteIcon =
  | 'flask' | 'label' | 'library' | 'chef' | 'coins' | 'factory' | 'users' | 'clock' | 'target' | 'upload' | 'phone' | 'shield'

export type FeatureGroup = {
  slug: string
  icon: SiteIcon
  title: string
  lead: string
  points: string[]
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    slug: 'formulations',
    icon: 'flask',
    title: 'Formulations that add up',
    lead: 'A recipe grid built for R&D: weights, percentages and batch size stay in step while you work.',
    points: [
      'Type a weight or a percentage and everything else recalculates. Lock a weight, a percentage or the whole batch.',
      'Scale to any batch size, and show amounts in grams, kilograms, ounces or pounds, for a column or one line.',
      'Keep every iteration. Try a change without losing the last version, and lock a finished recipe so nobody edits it by mistake.',
      'Write the method as process steps, record bench measurements, and account for moisture and weight lost in cooking or drying.',
      'Add ingredients after a step, with their usage measured against what that step yields.',
      'Bring a recipe in from Excel or CSV and Benchtop matches its lines to your library.',
    ],
  },
  {
    slug: 'nutrition',
    icon: 'label',
    title: 'Nutrition and labels',
    lead: 'Nutrition is worked out as you formulate, and the label pieces are ready when the recipe is.',
    points: [
      'Live nutrition per batch, per 100 g and per serving, with a per-ingredient breakdown of where each nutrient comes from.',
      'An FDA-style Nutrition Facts panel with the rounding rules applied, downloadable as PNG, JPG or PDF.',
      'The INGREDIENTS: statement in descending order, with sub-ingredients and allergens drawn from your library.',
      'Vitamin units handled properly, including IU conversions and the form of the vitamin.',
    ],
  },
  {
    slug: 'targets',
    icon: 'target',
    title: 'Targets and reverse engineering',
    lead: 'Set the goals once on a project and every formulation is checked against them.',
    points: [
      'Nutrition targets on a project, such as at least 10 g protein or under 5 g added sugar per serving, with a clear pass or miss on every formulation.',
      'Let Benchtop suggest amounts that meet the targets from the ingredients you choose.',
      'Start from a competitor’s or a target label, and the reverse-engineering wizard works out a recipe that matches it.',
    ],
  },
  {
    slug: 'ingredients',
    icon: 'library',
    title: 'An ingredient library you can trust',
    lead: 'Every raw material in one place, with the data that feeds your labels, costs and stock.',
    points: [
      'Import complete nutrition from USDA FoodData Central in a couple of clicks.',
      'Photograph a package, paste a product page or attach a spec sheet, and AI reads the nutrition, allergens and ingredients for you to check.',
      'Allergens, certifications, documents, suppliers, pack sizes and prices on every ingredient.',
      'Mark data as verified so the team knows what has been checked, and merge duplicates without breaking recipes.',
      'Lab Intake: photograph the containers on a shelf and add them to the library in one pass.',
    ],
  },
  {
    slug: 'sous-chef',
    icon: 'chef',
    title: 'Sous Chef, your AI lab-mate',
    lead: 'Ask the food science question you would otherwise take to a colleague, right beside the recipe.',
    points: [
      'Answers on texture, shelf life, sugar reduction, emulsions and more, with the reasons behind each suggestion.',
      'Ingredient swaps and strategies for hitting a target, in the context of the formulation you have open.',
      'A shared lab notebook of the team’s decisions and learnings, which Sous Chef applies in every later conversation.',
    ],
  },
  {
    slug: 'costing',
    icon: 'coins',
    title: 'Costs and stock',
    lead: 'Know what a recipe costs before it leaves the bench.',
    points: [
      'Ingredient cost per batch, per kilogram, per serving and per package, from your supplier prices.',
      'Track stock levels, and what is physically on the lab shelf.',
      'Log a production run and the ingredients you used come off your stock.',
    ],
  },
  {
    slug: 'production',
    icon: 'factory',
    title: 'From bench to production',
    lead: 'Hand off clean paperwork, with your own branding on it.',
    points: [
      'Printouts of the recipe, method and checks for the lab or the plant.',
      'Your company logo on printouts, PDFs and reports.',
      'Turn a finished recipe, such as a sauce or a premix, into an ingredient you can use in other formulations.',
    ],
  },
  {
    slug: 'clients',
    icon: 'users',
    title: 'Clients, teams and permissions',
    lead: 'Built for brands, co-manufacturers and consultants who formulate for others.',
    points: [
      'Client records with contacts, accounting and shipping details, linked to their projects.',
      'Invite coworkers as owners, admins or members, and limit a member to one client’s projects or a few projects, as view or edit.',
      'Archive a client with its projects and formulations, and restore exactly what you need later.',
    ],
  },
  {
    slug: 'time',
    icon: 'clock',
    title: 'Time tracking for consultants',
    lead: 'Optional, and off until you turn it on.',
    points: [
      'Log billable time against a client and project, or run a timer while you work.',
      'Mark time as billed so nothing is invoiced twice.',
      'Send clients a clean time report as a PDF or spreadsheet.',
    ],
  },
  {
    slug: 'anywhere',
    icon: 'phone',
    title: 'Works where you work',
    lead: 'On the desktop in the office, and on a phone at the bench.',
    points: [
      'Install Benchtop on your home screen or dock so it opens in its own window.',
      'Light and dark appearance.',
      'A built-in Help center with step-by-step guides for every part of the app.',
    ],
  },
]

// The short list on the home page
export const HOME_HIGHLIGHTS: { icon: SiteIcon; title: string; text: string }[] = [
  { icon: 'flask', title: 'Formulate', text: 'Weights, percentages and batch size stay in step. Every iteration is kept.' },
  { icon: 'label', title: 'Label', text: 'Live nutrition, an FDA-style Nutrition Facts panel and the ingredient statement.' },
  { icon: 'library', title: 'Build your library', text: 'USDA imports, plus AI that reads packages, product pages and spec sheets.' },
  { icon: 'chef', title: 'Ask Sous Chef', text: 'Food science answers and ingredient swaps, beside the recipe you have open.' },
  { icon: 'coins', title: 'Cost it', text: 'Cost per batch, kilo, serving and package, and stock that updates with production.' },
  { icon: 'users', title: 'Work with clients', text: 'Client records, team roles and project-level permissions.' },
]

export const HOW_IT_WORKS = [
  { step: '01', title: 'Stock the library', text: 'Add your ingredients from USDA, a photo, a product page or a spec sheet.' },
  { step: '02', title: 'Open a project', text: 'One folder per product idea, with the nutrition targets it has to meet.' },
  { step: '03', title: 'Formulate and iterate', text: 'Build the recipe, check it against the targets, and keep every version.' },
  { step: '04', title: 'Label and hand off', text: 'Download the Nutrition Facts panel and statement, then print the batch sheet.' },
]

export const PRICING = {
  monthly: PLAN_PRICE_USD.month,
  yearly: PLAN_PRICE_USD.year,
  seatMonthly: SEAT_PRICE_USD.month,
  seatYearly: SEAT_PRICE_USD.year,
  trialDays: PAID_TRIAL_DAYS,
  yearlySavings: PLAN_PRICE_USD.month * 12 - PLAN_PRICE_USD.year,
}

export const PLAN_INCLUDES = [
  'Every feature, with no tiers or add-ons',
  'Unlimited projects, formulations and ingredients',
  'Nutrition Facts panels and ingredient statements',
  'Sous Chef AI assistant and the team lab notebook',
  'Costing, stock and production logs',
  'Clients, team roles and permissions',
  'Data export at any time',
]

export type SiteFaq = { q: string; a: string }
export type SiteFaqGroup = { title: string; faqs: SiteFaq[] }

export const FAQ_GROUPS: SiteFaqGroup[] = [
  {
    title: 'The beta',
    faqs: [
      {
        q: 'What is Benchtop?',
        a: 'Benchtop is a workspace for developing food, beverage and supplement formulations. It keeps your ingredient library, works out nutrition as you formulate, builds the Nutrition Facts panel and ingredient statement, tracks costs and stock, and keeps every version of a recipe as you improve it.',
      },
      {
        q: 'Who is it for?',
        a: 'Product developers and food scientists at brands and startups, co-manufacturers, and consultants who formulate for clients. If you live in spreadsheets to build recipes and labels, it is for you.',
      },
      {
        q: 'How do I join the beta?',
        a: 'Send a request from the Request an invite page. We review every request and email an invitation link to the people we can take on. The link lets you create your login and your company’s private workspace.',
      },
      {
        q: 'How long does it take to hear back?',
        a: 'We read every request, usually within a few business days. We add beta accounts in small groups so we can help each one get set up, so there can be a short wait.',
      },
      {
        q: 'What do you expect from beta testers?',
        a: 'Use Benchtop for real work and tell us what gets in the way. There is a feedback link at the bottom of every page in the app for bug reports and feature requests, and they come straight to the people building it.',
      },
      {
        q: 'I was invited by a coworker. Do I need to request an invite?',
        a: 'No. If your company already uses Benchtop, the account’s owner or an admin can invite you from the Team page. Use the link they send you.',
      },
    ],
  },
  {
    title: 'Pricing and billing',
    faqs: [
      {
        q: 'How much does Benchtop cost?',
        a: `$${PLAN_PRICE_USD.month} a month or $${PLAN_PRICE_USD.year} a year, which includes the account owner. Each extra person on your team is $${SEAT_PRICE_USD.month} a month or $${SEAT_PRICE_USD.year} a year.`,
      },
      {
        q: 'Is there a free trial?',
        a: `Yes. New accounts start with a ${PAID_TRIAL_DAYS}-day free trial with every feature. You don’t need a card to start.`,
      },
      {
        q: 'If I subscribe during my trial, am I charged right away?',
        a: 'No. The first charge happens when your free trial ends, so subscribing early doesn’t cost you any free days.',
      },
      {
        q: 'Can I switch between monthly and yearly?',
        a: 'Yes, at any time from Settings. You are charged for the new period straight away, less a credit for the unused part of the current one.',
      },
      {
        q: 'What happens if I cancel?',
        a: 'You keep full access until the end of the period you have paid for. Your data is kept, and subscribing again brings everything back exactly as it was. You can also download all of it, or delete the account.',
      },
      {
        q: 'Who handles payments?',
        a: 'Stripe. Your card details go straight to Stripe and never reach Benchtop.',
      },
    ],
  },
  {
    title: 'Data and privacy',
    faqs: [
      {
        q: 'Who can see my formulations?',
        a: 'Only the people on your account, and only what they have been given access to. Every account is a separate workspace, and data is never shared between accounts.',
      },
      {
        q: 'Do you sell or share my data?',
        a: 'No. We will never sell your data or your clients’ data, and we don’t share it with anyone unless the law requires us to. The only companies that handle it are the service providers that run the features you use, on our behalf.',
      },
      {
        q: 'What happens to what I send to the AI features?',
        a: 'When you use an AI feature, such as reading a label photo or asking Sous Chef a question, the content you submit is sent to our AI provider, Anthropic, to produce the result. It is used to answer you, not sold or shared.',
      },
      {
        q: 'Can I get my data out?',
        a: 'Yes. The account owner can download a full copy of the account’s data at any time from Settings, and can permanently delete the account and everything in it.',
      },
    ],
  },
  {
    title: 'Using Benchtop',
    faqs: [
      {
        q: 'Do I need to install anything?',
        a: 'No. Benchtop runs in your browser on a computer, tablet or phone. You can also add it to your home screen or dock so it opens in its own window.',
      },
      {
        q: 'Can I bring my existing recipes?',
        a: 'Yes. Import a formulation from an Excel or CSV file and Benchtop matches its lines to your ingredient library. Ingredients can come from USDA FoodData Central, package photos, product pages or spec sheets.',
      },
      {
        q: 'Does it make labels for the US market?',
        a: 'Benchtop builds an FDA-style Nutrition Facts panel and ingredient statement with the FDA rounding rules applied. You remain responsible for the accuracy and compliance of your final labels, so have them reviewed before they go to print.',
      },
      {
        q: 'Can I use it for clients?',
        a: 'Yes. Keep client records, link their projects, limit teammates to particular clients, put your logo on printouts, and optionally track billable time.',
      },
    ],
  },
]
