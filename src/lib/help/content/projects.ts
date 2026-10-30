import type { HelpSection } from '../types'

export const projects: HelpSection = {
  slug: 'projects',
  title: 'Projects & targets',
  icon: 'folder',
  intro:
    'A project is a folder for one product idea. It holds that product’s formulations and the nutrition targets they all have to meet. This section covers creating and organizing projects, linking a client, and setting targets.',
  articles: [
    {
      slug: 'projects-list',
      title: 'The Projects page',
      summary: 'Your home page: every project you can see.',
      blocks: [
        {
          type: 'p',
          text: '[Projects](/projects) is the first page you see after signing in. It lists every project you have access to, with the most recently changed at the top. Click any row to open that project.',
        },
        {
          type: 'terms',
          items: [
            { term: 'Project', text: 'The project’s name.' },
            { term: 'Client', text: 'The customer it’s for, if one is linked (— means none).' },
            { term: 'Formulations', text: 'How many formulations are inside. All the versions of one formulation count once, and archived formulations are included.' },
            { term: 'Status', text: '`active` (green) or `archived` (gray).' },
            { term: 'Updated', text: 'When the project itself was last changed (renamed, client changed, targets edited, archived). Editing a formulation inside doesn’t change this date.' },
          ],
        },
        {
          type: 'note',
          text: 'On a phone, only the Project and Formulations columns fit on screen. Archived projects stay in the list with a gray badge; there is no filter to hide them.',
        },
      ],
    },
    {
      slug: 'create-project',
      title: 'Creating a project',
      summary: 'Start a new folder for a product.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Go to [Projects](/projects) and click `New project` in the top-right corner.',
            'Type a **Project name**, for example “Plant Protein Shake v3”. This is the only required field.',
            'Optionally pick a **Client** from the list. If you’re allowed to add clients, choose **+ New client…** to add one on the spot.',
            'Optionally write an **Objective**, the goal for the product, such as “30 g protein per serving, clean label, nut-free”.',
            'Click `Create project`. The new project opens straight away.',
          ],
        },
        {
          type: 'tip',
          text: 'You can change the **Objective** later: on the project page, hover over it and click the **pencil** (or click `+ Add objective` if it’s blank).',
        },
        {
          type: 'note',
          text: 'Don’t see `New project`? Your access is limited. Members can create projects only for clients they have edit access to, or for any project if “All projects” is set to `Can edit`. Ask an owner or admin. See [Choosing what a member can see](/help/team#member-access).',
        },
      ],
    },
    {
      slug: 'project-page',
      title: 'Inside a project: renaming, clients and archiving',
      summary: 'What’s on a project page and how to change it.',
      blocks: [
        {
          type: 'p',
          text: 'A project page shows the name, the client, the status and the objective at the top, then the **Formulations** list, then the **Nutritional targets**.',
        },
        { type: 'h', text: 'Rename a project' },
        {
          type: 'steps',
          items: [
            'Move your mouse over the project name. A small pencil appears.',
            'Click the pencil, type the new name, and click `Save` (or press Enter).',
          ],
        },
        { type: 'h', text: 'Link, change or remove the client' },
        {
          type: 'steps',
          items: [
            'If there’s no client yet, click **+ Add client**. If there is one, click the small pencil next to its name.',
            'Choose a client from the list, or **No client** to unlink it.',
            'Click `Save`. You’ll see “Client updated”.',
          ],
        },
        {
          type: 'warning',
          text: 'Changing a project’s client can change which teammates can see it, because members can be given access by client. See [Choosing what a member can see](/help/team#member-access).',
        },
        { type: 'h', text: 'Archive or restore a project' },
        {
          type: 'p',
          text: 'Click `Archive` in the top-right corner. The status changes to `archived` right away (there’s no pop-up). Click `Restore` to make it active again. Archiving is just a label to show the project is finished or on hold: the project stays in the list and can still be opened and edited.',
        },
        {
          type: 'note',
          text: 'Projects can’t be deleted, only archived. This protects your records from accidental loss.',
        },
      ],
    },
    {
      slug: 'formulations-in-project',
      title: 'The Formulations list in a project',
      summary: 'Creating formulations, and finding archived ones.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Open the project and click `New formulation` (or **Create first formulation →** if it’s empty).',
            'Type a **Name**, such as “Formula A — High Protein”.',
            'Choose a **Mode**: **Ground up — build from ingredients** if you’re creating your own recipe (most common), or **Reverse engineer — match a target label** to copy an existing product from its label.',
            'Click `Create`. The formulation opens. See [Formulations](/help/formulations) for what to do next.',
          ],
        },
        {
          type: 'warning',
          text: 'You can’t change the mode later. If you picked the wrong one, create a new formulation with the right mode.',
        },
        { type: 'p', text: 'The list shows one row per formulation, using its newest version:' },
        {
          type: 'terms',
          items: [
            { term: 'Name', text: 'A lock icon means the newest version is finalized; a pencil icon means it’s still a draft.' },
            { term: 'Mode', text: '**Ground up** or **Reverse**.' },
            { term: 'Version', text: 'The newest version number, such as `v3`, and how many versions (iterations) exist.' },
            { term: 'Status', text: '`draft` (can be edited) or `locked` (finalized).' },
            { term: 'Updated', text: 'When it was last changed.' },
          ],
        },
        {
          type: 'p',
          text: '**Finding archived formulations:** click `Archived (N)` above the list to show them (faded), and `Restore` to bring one back. Click `Hide archived` to hide them again.',
        },
      ],
    },
    {
      slug: 'targets',
      title: 'Nutritional targets: setting goals for a product',
      summary: 'Set requirements once, and every formulation in the project is checked against them.',
      blocks: [
        {
          type: 'p',
          text: 'A **target** is a nutrition rule your product must meet, such as “Protein at least 20 g per serving” or “Sodium no more than 140 mg per serving”. Targets belong to the project, so every formulation and version inside it is checked against the same list. The **Solve** button on a formulation also uses them to suggest amounts.',
        },
        { type: 'h', text: 'Add a target' },
        {
          type: 'steps',
          items: [
            'Open the project and scroll to **Nutritional targets**.',
            'Click `Add target`.',
            'Under **Nutrient**, choose the nutrient. Its unit (g, mg, kcal…) fills in automatically.',
            'Under **Rule**, choose `≥ min` (at least), `≤ max` (no more than), `= exact`, or `between` (a range, with a min and a max).',
            'Under **Value**, type the number. It must be greater than 0. For `between`, type the min and the max.',
            'Under **Unit**, choose the nutrient’s own unit, `% of 100g` (a share of the product’s weight, so 20% protein means 20 g of protein in every 100 g), or `% DV` (a share of the FDA Daily Value, so 20% DV calcium means 260 mg). `% of 100g` is offered only for nutrients measured by weight, and `% DV` only for nutrients that have a Daily Value.',
            'Under **Per**, choose `100 g` or `serving`. For a serving, you can also type a reference **Serving size** in grams, used for formulations that don’t have their own. A `% of 100g` target is always per 100 g, since the share is the same in any amount of the product.',
            'Under **Measured on**, choose `as is` (the finished batch, water included) or `dry basis` (the dry matter only, with the water taken out). A dry-basis target is always per 100g of dry matter.',
            'Click `Save target`. You’ll see “Target saved”.',
          ],
        },
        {
          type: 'p',
          text: 'To change a target, move your mouse over it and click the pencil. To remove it, click the **X** and confirm. Every change saves immediately.',
        },
        { type: 'h', text: 'Dry basis' },
        {
          type: 'p',
          text: 'A dry-basis target ignores water. For example, “Protein at least 70 g per 100 g dry” is met by a yogurt base with 34% protein as is, if 54% of it is water. Benchtop works out the batch’s dry matter from each ingredient’s **Moisture %**, so every ingredient in the formula needs one. To add it without leaving the formula, click the ingredient’s name and type it in the **Moisture** box at the top of the panel; it saves when you leave the box. You can also use `Edit` on the ingredient’s page. Ingredients added from USDA get it automatically. Drying steps don’t change a dry-basis value, since only water leaves. **Solve** works with dry-basis targets too.',
        },
        { type: 'h', text: 'How formulations are checked' },
        {
          type: 'p',
          text: 'On each formulation in the project, a **Validation** table compares the formulation’s nutrition with every target:',
        },
        {
          type: 'terms',
          items: [
            { term: 'Pass (green check)', text: 'The target is met.' },
            { term: 'Warn (yellow)', text: 'Close but not quite: within 5% of the limit (for “= exact”, between 2% and 5% off).' },
            { term: 'Fail (red X)', text: 'More than 5% off.' },
            { term: '— (no data)', text: 'Benchtop can’t check it. See the FAQ below.' },
          ],
        },
        {
          type: 'p',
          text: 'Nutrition is measured on the **finished** product, after any losses you entered in process steps (such as water lost in baking). For per-serving targets Benchtop uses the formulation’s serving size, or the target’s own reference serving size if the formulation doesn’t have one.',
        },
        {
          type: 'tip',
          text: 'Always set a serving size on the formulation when you use per-serving targets. The **Solve** tool only uses the formulation’s own serving size; without one it treats per-serving targets as per 100 g.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'How do I delete a project?',
      a: 'Projects can’t be deleted. Click `Archive` on the project page instead. It stays in the list with a gray `archived` badge, and you can `Restore` it any time.',
    },
    {
      q: 'Can I hide archived projects?',
      a: 'Not at the moment. Archived projects stay in the list with a gray badge so you can always find them.',
    },
    {
      q: 'Can I change the project objective after creating it?',
      a: 'Yes. On the project page, hover over the objective and click the **pencil**, or click `+ Add objective` if there isn’t one. Edit it and click `Save`.',
    },
    {
      q: 'Why don’t I see a “New project” button?',
      a: 'Your access is limited. Ask an owner or admin to give you `Can edit` on all projects or on a client. See [Choosing what a member can see](/help/team#member-access).',
    },
    {
      q: 'It says “No projects have been shared with you yet.”',
      a: 'New team members start with no project access. Ask an owner or admin to give you access in [Settings → Team](/settings/team).',
    },
    {
      q: 'What does the “view only” badge on a project mean?',
      a: 'You can open and look at the project and its formulations, print them and see Nutrition Facts, but you can’t change anything. Ask an owner or admin if you need edit access.',
    },
    {
      q: 'Why can’t I choose “No client” for a project?',
      a: 'Your access only covers certain clients, so every project you create or move has to belong to one of them.',
    },
    {
      q: 'Why does a target show “—” instead of pass or fail?',
      a: 'Benchtop can’t check it. Usually it’s one of these: (1) it’s a per-serving target and there’s no serving size, so the Actual column says “set serving size”; (2) none of the ingredients has data for that nutrient; (3) the units can’t be converted, such as vitamin E in IU with no form chosen, or a % DV target for a nutrient that has no Daily Value; (4) a “between” target has no maximum; (5) it’s a dry-basis target and an ingredient has no moisture %, so the Actual column says “add moisture %”.',
    },
    {
      q: 'Why can’t I save a target of 0 (for example, 0 g trans fat)?',
      a: 'Targets must be greater than 0. Use a small number instead, such as `≤ max` 0.1 g.',
    },
    {
      q: 'Can each formulation have different targets?',
      a: 'No. Targets belong to the project and apply to every formulation in it. If two products need different targets, put them in separate projects.',
    },
    {
      q: 'What do pass, warn and fail mean?',
      a: 'Pass means the target is met. Warn means it’s within 5% of the limit. Fail means it’s further off than that.',
    },
    {
      q: 'Can I move a formulation to a different project?',
      a: 'No. Formulations stay in the project they were created in, and copies (Duplicate → New formulation) are made in the same project.',
    },
    {
      q: 'Do projects need unique names?',
      a: 'No, but unique names make your list much easier to read.',
    },
  ],
}
