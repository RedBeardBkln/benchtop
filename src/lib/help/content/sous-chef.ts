import type { HelpSection } from '../types'

export const sousChef: HelpSection = {
  slug: 'sous-chef',
  title: 'Sous Chef',
  icon: 'chef',
  intro:
    'Sous Chef is your AI product-development sidekick: ask it about food science and molecular gastronomy, get ingredient swaps and strategies for hitting a target, and keep the team’s decisions in a lab notebook that carries into every future project.',
  articles: [
    {
      slug: 'asking',
      title: 'Asking Sous Chef',
      summary: 'Start a conversation from the menu, or beside any project or formulation.',
      blocks: [
        {
          type: 'p',
          text: 'Sous Chef knows food science broadly (ingredient functionality, texture, emulsions, water activity, shelf life, processing, flavor, nutrition, labeling and molecular gastronomy), not just what’s in your account. It can also read your projects, formulations and ingredient library, and search the web for current facts such as regulations or supplier products.',
        },
        {
          type: 'steps',
          items: [
            'Open [Sous Chef](/sous-chef) from the menu (on a phone, under **More**), or click **Ask Sous Chef** at the bottom right of a project or formulation to open it beside the page.',
            'Type a question and press Enter (Shift+Enter starts a new line). In a conversation about a formulation, Sous Chef reads it first, with its lines, targets and nutrient profile.',
            'While it works you’ll see what it looked at, for example “Read a formulation” or “Searched the web for …”.',
          ],
        },
        {
          type: 'tip',
          text: 'Be specific about the target: “Get this bar to 10 g protein per serving without going over $4/kg, using what we have on hand” gets a better answer than “more protein?”.',
        },
        {
          type: 'note',
          text: 'Sous Chef reads your data but never changes it. When it suggests a change, it tells you what to change and where. Check safety-critical and regulatory advice, and confirm changes at the bench.',
        },
      ],
    },
    {
      slug: 'beside-your-work',
      title: 'Sous Chef beside a project or formulation',
      summary: 'Link a conversation to an iteration, a whole formulation or a project, and jump between them without losing the chat.',
      blocks: [
        {
          type: 'p',
          text: 'On a project or formulation, **Ask Sous Chef** opens Sous Chef in a panel beside the page, so you can keep the formula in view while you talk it through.',
        },
        {
          type: 'terms',
          items: [
            { term: 'This iteration', text: 'The version you’re looking at, for example v3. Sous Chef reads that iteration and knows about the others.' },
            { term: 'The whole formulation', text: 'Every iteration of the formulation. Good for following how it changed from version to version.' },
            { term: 'The project', text: 'The project and all its formulations.' },
          ],
        },
        {
          type: 'steps',
          items: [
            'Click **Ask Sous Chef**. Under **New conversation about**, pick what the conversation is about, or pick up a conversation listed under **About this formulation** or **About the project**.',
            'To change what a conversation is linked to, click **Change** under its title and pick another level, or **Nothing** to unlink it.',
            'When Sous Chef mentions another iteration, another formulation in the project or the project itself, the name is a link. Click it to open it; the conversation stays open in the panel, even while Sous Chef is still answering.',
          ],
        },
        {
          type: 'tip',
          text: 'Following a link from the full Sous Chef page opens the formulation with the conversation carried on in the panel beside it.',
        },
        {
          type: 'note',
          text: 'If the formulation you’re on has unsaved changes, following a link asks first. Save, or choose **Leave anyway** to discard them.',
        },
      ],
    },
    {
      slug: 'lab-notebook',
      title: 'The lab notebook',
      summary: 'Decisions and learnings Sous Chef applies in every later conversation.',
      blocks: [
        {
          type: 'p',
          text: 'When you make or confirm a decision, state a lasting preference or constraint, or report a bench result, Sous Chef records it in the team’s lab notebook and tells you it did. Every later conversation, on every project, starts with the notebook, so Sous Chef applies what the team already settled.',
        },
        {
          type: 'terms',
          items: [
            { term: 'Decision', text: 'Something the team chose, and why. “Use allulose rather than erythritol; erythritol’s cooling was rejected in sensory.”' },
            { term: 'Preference', text: 'How the team or a client likes things done. “Client X wants no gums on the label.”' },
            { term: 'Learning', text: 'Something found at the bench or in a trial. “0.3% gellan set too firm in the oat drink; 0.2% was right.”' },
            { term: 'Constraint', text: 'A rule every formulation must respect. “Everything we make must be peanut-free.”' },
          ],
        },
        {
          type: 'steps',
          items: [
            'Click **Lab notebook** at the top right of Sous Chef to see every note.',
            'Click **Add note** to record one yourself.',
            'Hover a note to edit it, retire it (Sous Chef stops applying it, but it stays on record) or delete it.',
          ],
        },
        {
          type: 'p',
          text: 'The notebook is shared by your whole team. A note tied to a project is only shown to people who can see that project. The person who recorded a note, and owners and admins, can change it.',
        },
      ],
    },
    {
      slug: 'conversations',
      title: 'Your conversations',
      summary: 'Conversations are saved and private to you.',
      blocks: [
        {
          type: 'list',
          items: [
            'Every conversation is saved down the left of Sous Chef (on a phone, behind the speech-bubble button). Only you can see your conversations.',
            'Hover one to rename or delete it. Deleting a conversation keeps any notes it recorded in the lab notebook.',
            'Sous Chef can search your earlier conversations when you refer back to something you discussed before.',
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'Does Sous Chef only know what’s in my account?',
      a: 'No. It draws on broad food science and culinary knowledge, can search the web, and reads your projects, formulations and ingredients when the question is about your work.',
    },
    {
      q: 'Can Sous Chef change my formulations?',
      a: 'No. It can read your data but not change it. It tells you what to change, and you make the change yourself.',
    },
    {
      q: 'Sous Chef recorded a note I don’t agree with. How do I remove it?',
      a: 'Open **Lab notebook** in Sous Chef, hover the note and retire or delete it. You can also tell Sous Chef it’s wrong, and it will retire it and record the correction.',
    },
  ],
}
