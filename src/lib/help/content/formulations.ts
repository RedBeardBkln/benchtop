import type { HelpSection } from '../types'

export const formulations: HelpSection = {
  slug: 'formulations',
  title: 'Formulations',
  icon: 'beaker',
  intro:
    'A formulation is a recipe. This section explains the formulation page from top to bottom: adding ingredients, how weights and percentages work, locks, nutrition, process steps and yield, versions, the Nutrition Facts panel, printing, costs, and the reverse-engineering wizard.',
  articles: [
    {
      slug: 'layout',
      title: 'A tour of the formulation page',
      summary: 'What each part of the page is for.',
      blocks: [
        {
          type: 'p',
          text: 'Open a formulation from its project (go to [Projects](/projects), open a project, click a formulation). From top to bottom you’ll see:',
        },
        {
          type: 'terms',
          items: [
            { term: '← Project name', text: 'Takes you back to the project.' },
            { term: 'Name and version', text: 'The formulation’s name, its version (such as `v2`), a box to describe this version, the mode (**Ground up** or **Reverse**) and status (**draft** or **locked**).' },
            { term: 'Buttons (top right)', text: '`Save`, `Solve`, `Duplicate`, `Finalize` / `Unlock`, `Save as ingredient`, `NFP`, `Print`, `Complete batch`, `Archive`, and for reverse formulations `Reverse wizard`. Some only appear when they apply.' },
            { term: 'Grey settings bar', text: '**Batch (g)**, **Serving (g)** and **Yield**.' },
            { term: 'Formula / COGS tabs', text: 'Only if you turned on COGS in [Preferences](/settings/preferences).' },
            { term: 'Ingredient grid', text: 'The recipe itself: each ingredient with its weight, percentage and nutrients.' },
            { term: 'Process steps', text: 'The method: how to make it, with losses, temperatures and times.' },
            { term: 'Full nutrient profile', text: 'Every nutrient, and which ingredients it comes from.' },
            { term: 'Validation', text: 'A pass/fail check against the project’s targets.' },
          ],
        },
        {
          type: 'note',
          text: 'If you see a yellow **view only** badge, you can look but not change anything. Ask an owner or admin for edit access to this project.',
        },
      ],
    },
    {
      slug: 'saving',
      title: 'Saving your work (important)',
      summary: 'What needs the Save button and what saves on its own.',
      blocks: [
        {
          type: 'warning',
          text: 'Changes to the ingredient grid are **not saved automatically**. When you change something, a blue `Save` button appears in the top-right corner. Click it before you leave the page or switch versions. If you try to leave with unsaved changes, Benchtop asks you to confirm first; choosing to leave anyway throws them away.',
        },
        {
          type: 'terms',
          items: [
            { term: 'Needs Save', text: 'Adding, removing or reordering ingredients; weights and percentages; locks; batch size; serving size.' },
            { term: 'Saves by itself', text: 'The version note, process steps, nutrient column choices, the COGS unit size, saved Nutrition Facts panels, renaming, finalizing, and archiving.' },
          ],
        },
        {
          type: 'p',
          text: 'Some tools use what is on screen, even before you save: the totals, nutrition, Validation, the Nutrition Facts panel and COGS. Others use the **last saved** version, so save first: **Print**, **Solve**, **Duplicate**, **Complete batch** and **Save as ingredient**.',
        },
      ],
    },
    {
      slug: 'add-ingredients',
      title: 'Adding and removing ingredients',
      summary: 'Build the recipe from your ingredient library.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Click **+ Add ingredient** under the grid (or **Add first ingredient →** if the formulation is empty).',
            'Start typing the ingredient’s name in **Search ingredients…**. Up to 8 matches from your library appear. A green **On hand** badge means you have it in the lab; a ✓ means it’s verified.',
            'Click the one you want. It’s added with a weight of 0.',
            'Type its amount in the **Amount** column (or a percentage in the **%** column). Amounts are in grams unless you choose another unit; see [Units: g, oz, lb, mL and more](#units).',
            'Repeat for every ingredient, then click `Save`.',
          ],
        },
        {
          type: 'p',
          text: 'If the ingredient isn’t in your library yet, choose **Add manually** to type it in, or **Import from USDA** to look it up in the USDA FoodData Central database. It’s added to your library and to the recipe in one go. See [Adding ingredients](/help/ingredients#add-manual).',
        },
        {
          type: 'list',
          items: [
            '**Remove** an ingredient: move your mouse over its row and click the **X** at the right end (on a phone the X is always visible). Then `Save`.',
            '**Reorder**: drag a row by the dotted handle on its left onto another row. Or use **Sort:** `By weight` to put the heaviest first. Then `Save`.',
            'Each ingredient can only be in a formulation once. If you try to add it again, you’ll see “… is already in this formulation”. Change its amount instead.',
            'A formulation can have up to 200 ingredients.',
          ],
        },
        {
          type: 'terms',
          items: [
            { term: '⚠ next to a name', text: 'The ingredient isn’t verified yet: nobody has confirmed its data. See [Verifying ingredients](/help/ingredients#verify).' },
            { term: 'Green dot', text: 'The ingredient is on hand in the lab.' },
            { term: '“On hand instead: …”', text: 'This ingredient isn’t on hand, but you have similar ones (same category) that are. Click to swap one in.' },
          ],
        },
      ],
    },
    {
      slug: 'weight-percent',
      title: 'How weights, percentages, batch size and serving size work',
      summary: 'The math behind the grid, explained simply.',
      blocks: [
        {
          type: 'terms',
          items: [
            { term: 'Amount', text: 'How much of that ingredient goes into the batch: grams to up to 4 decimal places, or another unit you choose. See [Units: g, oz, lb, mL and more](#units).' },
            { term: '%', text: 'That ingredient’s share of the whole batch: its weight ÷ the total weight × 100. All the percentages add up to 100%.' },
            { term: 'Batch (g)', text: 'The total weight of all ingredients you put in, before any cooking or processing losses.' },
            { term: 'Serving (g)', text: 'How much one serving weighs. It’s needed for per-serving nutrition, the Nutrition Facts panel, per-serving targets and per-serving cost.' },
            { term: 'Yield', text: 'How much finished product you get, after the losses in your process steps. Shown as a % and in grams. See [Process steps, losses and yield](#process-steps).' },
          ],
        },
        { type: 'h', text: 'What happens when you type' },
        {
          type: 'list',
          items: [
            '**Type a weight:** only that ingredient changes. The batch total and everyone’s percentages update to match.',
            '**Type a percentage:** that ingredient is set to that share of the batch. The other ingredients keep their grams, so the batch total changes.',
            '**Type a new Batch (g) and press Enter:** the whole recipe scales up or down to that size, keeping the same proportions. This is how you turn a 1,000 g lab batch into a 50,000 g production batch.',
          ],
        },
        {
          type: 'p',
          text: 'Example: 600 g oats + 300 g whey + 100 g cocoa = 1,000 g, so the percentages are 60%, 30% and 10%. Type 2000 in **Batch (g)** and you get 1,200 g, 600 g and 200 g, still 60/30/10.',
        },
        {
          type: 'tip',
          text: 'Want to see more decimal places in the % column? Use the **−** and **+** buttons in the % column header to show 1 to 4 decimals.',
        },
      ],
    },
    {
      slug: 'units',
      title: 'Units: g, oz, lb, mL and more',
      summary: 'Show and type amounts in the unit you work in, for the whole column or one ingredient.',
      blocks: [
        {
          type: 'p',
          text: 'The **Amount** column can show and take amounts in grams, kilograms, milligrams, ounces or pounds, or by volume in mL, L, teaspoons, tablespoons, fluid ounces or cups. Benchtop always stores amounts in grams, so changing the unit never changes the formula, its percentages or its nutrition.',
        },
        { type: 'h', text: 'Change the unit for the whole column' },
        {
          type: 'steps',
          items: [
            'Open the formulation.',
            'In the **Amount** column header, choose a unit from the drop-down next to the word Amount.',
            'Every amount, and the Total row, switches to that unit. The choice is saved with the formulation straight away and copied to new iterations.',
          ],
        },
        { type: 'h', text: 'Change the unit for one ingredient' },
        {
          type: 'steps',
          items: [
            'Click the small unit drop-down just right of that ingredient’s amount.',
            'Choose a unit. The unit turns blue to show it’s the ingredient’s own, and it stays that way whatever the column’s unit is.',
            'To follow the column again, choose the first option in the list.',
            'Click `Save` to keep it.',
          ],
        },
        { type: 'h', text: 'Volume units need a density' },
        {
          type: 'p',
          text: 'To turn grams into mL or cups, Benchtop needs the ingredient’s **density**: how many grams one millilitre weighs (water is 1). If you choose a volume unit for an ingredient that doesn’t have one, Benchtop asks for it and saves it to the ingredient in your library. You can also set it by clicking the ingredient’s name in the formula (the **Density** box at the top of the panel), or with `Edit` on the ingredient’s page. When the whole column is in a volume unit, ingredients without a density stay in grams and their unit shows in amber. The Total row is in grams whenever the column is a volume unit, since a mix of ingredients has no single density.',
        },
        {
          type: 'tip',
          text: 'The printout shows each amount in the same unit as the grid. The batch size, serving size, stock and costs stay in grams.',
        },
      ],
    },
    {
      slug: 'locks',
      title: 'Locks: keeping amounts fixed while you change others',
      summary: 'Lock a weight, a percentage, or the whole batch size.',
      blocks: [
        {
          type: 'p',
          text: 'Padlocks let you hold some numbers steady while you adjust the rest. Click a padlock to lock it (it turns solid) and click again to unlock.',
        },
        {
          type: 'terms',
          items: [
            { term: 'Weight lock (next to Weight)', text: 'That ingredient keeps exactly the same grams, whatever else changes. Useful for a fixed amount like “exactly 2 g of salt”.' },
            { term: '% lock (next to %)', text: 'That ingredient always stays the same share of the batch. Useful for things like “flavor is always 0.5%”. You need to enter an amount first.' },
            { term: 'Batch lock (next to Batch (g))', text: 'The total batch weight stays fixed. When you change one ingredient, the **unlocked** ones grow or shrink, in proportion, to keep the total the same.' },
          ],
        },
        {
          type: 'p',
          text: 'An ingredient can have a weight lock or a % lock, not both. Locks are saved with `Save` and copied when you duplicate.',
        },
        { type: 'h', text: 'Fixing lock warnings' },
        {
          type: 'terms',
          items: [
            { term: '“Locked percentages add up to 100% or more…”', text: 'Your locked percentages leave no room for anything else. Unlock one or lower it.' },
            { term: '“Locked values leave … g of the … g batch unassigned”', text: 'Everything is locked but it doesn’t fill the batch. Leave at least one ingredient unlocked.' },
            { term: '“Locked values exceed the … g batch…”', text: 'Locked amounts add up to more than the locked batch. Unlock something or raise the batch size.' },
            { term: '“…that value was adjusted to fit the other locked values”', text: 'With the batch locked, there wasn’t room for the number you typed, so Benchtop used the largest amount that fits.' },
          ],
        },
      ],
    },
    {
      slug: 'nutrition',
      title: 'Nutrition: columns, totals and the full profile',
      summary: 'How Benchtop works out the nutrition, and how to read it.',
      blocks: [
        { type: 'h', text: 'How the numbers are calculated' },
        {
          type: 'steps',
          items: [
            'Each ingredient in your library has its nutrients recorded **per 100 g**.',
            'For each ingredient, Benchtop works out how much of each nutrient it adds to the batch. For example, 200 g of an ingredient with 10 g protein per 100 g adds 20 g protein.',
            'It adds those up for the whole batch.',
            'It divides by the finished weight to get the amount **per 100 g of finished product**, and multiplies by your serving size to get **per serving**.',
          ],
        },
        {
          type: 'warning',
          text: 'If an ingredient has no value for a nutrient, it counts as zero. Missing data makes totals too low, so make sure your ingredients have complete nutrition.',
        },
        { type: 'h', text: 'Reading the grid' },
        {
          type: 'list',
          items: [
            'The nutrient columns on each row show how much that ingredient adds to the **whole batch**.',
            'The **Total** row shows the weight total and, for nutrients, the amount **per 100 g finished**, not the sum of the column.',
            'The blue **Per 100 g finished** row and the green **Per serving** row (when a serving size is set) are what you’d use on a label.',
          ],
        },
        { type: 'h', text: 'Choosing which nutrients show as columns' },
        {
          type: 'steps',
          items: [
            'Click **Nutrient columns** above the grid.',
            'Tick the nutrients you want to see (use **Filter nutrients…** to find one). Greyed-out nutrients have no data in any of your ingredients.',
            'Close the panel. Your choice saves by itself for this version. **Reset to default** brings back Energy, Protein, Total Fat, Carbs and Dietary Fiber.',
          ],
        },
        { type: 'h', text: 'Full nutrient profile' },
        {
          type: 'p',
          text: 'Below the process steps, click **Full nutrient profile** to see every nutrient per 100 g and per serving. Click any nutrient to see which ingredients it comes from and their share. For example, click Sodium to find your saltiest ingredient.',
        },
        { type: 'h', text: 'Looking up an ingredient without leaving the page' },
        {
          type: 'p',
          text: 'Click an ingredient’s name in the grid to open a side panel with its **Nutrients**, **Allergens & Certs**, **Suppliers** and **Info**. You can set its **Moisture %** and **Density** in the boxes at the top (each saves when you leave the box), edit its nutrients (`Edit nutrients`), mark it verified, or swap it for another ingredient.',
        },
        {
          type: 'warning',
          text: 'Edits made in the side panel change the ingredient in your **library**, so they affect **every** formulation that uses it. The formulation you have open updates straight away.',
        },
      ],
    },
    {
      slug: 'swap',
      title: 'Swapping one ingredient for another',
      summary: 'Replace an ingredient but keep its amount.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Click the ingredient’s name in the grid, then click `Swap ingredient` at the bottom of the side panel. (Or click the green **On hand instead: …** hint under it.)',
            'Choose where the replacement comes from: **Ingredient Library**, **USDA Database**, or **Add Manually**.',
            'Pick the new ingredient. Ingredients you have on hand are listed first.',
            'The row keeps its weight and locks, and only the ingredient changes. Click `Save`.',
          ],
        },
      ],
    },
    {
      slug: 'process-steps',
      title: 'Process steps, losses and yield',
      summary: 'Write the method, record bench measurements, and account for weight lost in processing.',
      blocks: [
        { type: 'h', text: 'Adding a step' },
        {
          type: 'steps',
          items: [
            'Under the grid, find **Process steps**. Click the heading to open it if it’s closed.',
            'Type the instruction, such as “Bake at 175 °C for 25 minutes”.',
            'If this step loses weight, choose the loss type and amount (see below). Otherwise leave it at **No loss**.',
            'Click `Add step` (or press Enter).',
          ],
        },
        {
          type: 'p',
          text: 'Steps save by themselves as soon as you click out of a field; there’s no Save button for them. Drag a step by its handle to reorder it, or click its **X** to delete it (no confirmation).',
        },
        { type: 'h', text: 'Two kinds of loss' },
        {
          type: 'terms',
          items: [
            { term: 'Production loss', text: 'Product left behind on the bowl, paddle or pan. You end up with less product, but each gram is the same, so **nutrition per 100 g doesn’t change**.' },
            { term: 'Moisture loss', text: 'Water driven off by baking, boiling or drying. You end up with less product, and because only water left, everything else is more concentrated, so **nutrition per 100 g goes up**.' },
          ],
        },
        {
          type: 'p',
          text: 'Enter a loss in grams (`g`) or as a percentage (`% of batch`). A percentage is taken from the weight **going into that step**, after any earlier losses.',
        },
        {
          type: 'p',
          text: '**Example:** a 1,000 g batch. Step 1 has a 2% production loss, leaving 980 g. Step 2 has a 100 g moisture loss, leaving 880 g. **Yield** = 880 ÷ 1,000 = **88%**, and nutrition per 100 g is about 11% higher than the raw mix (980 ÷ 880).',
        },
        { type: 'h', text: 'Recording measurements at the bench' },
        {
          type: 'p',
          text: 'Each step has boxes for **Start** and **End** time, **pH** (0–14), **Temp (°C)** and **Temp (°F)** (type one and the other fills in), **Time (hh:mm:ss)**, **Speed**, **Equipment** and **Notes**. Click the small arrow on a step for **Solids (%)**, **Shear** and **Pressure**.',
        },
        {
          type: 'tip',
          text: 'To add a piece of equipment, open a step’s **Equipment** list and choose **+ Add new equipment…**, type its name, and click `Add`. Equipment is shared by everyone on your account.',
        },
      ],
    },
    {
      slug: 'validation-solve',
      title: 'Checking targets and using Solve',
      summary: 'See whether the recipe meets the project’s goals, and let Benchtop suggest amounts.',
      blocks: [
        {
          type: 'p',
          text: 'If the project has [nutritional targets](/help/projects#targets), a **Validation** table appears under the recipe showing **pass**, **warn** or **fail** for each one, using the amounts on screen (even before you save).',
        },
        { type: 'h', text: 'Solve: let Benchtop suggest amounts' },
        {
          type: 'p',
          text: '`Solve` looks for new percentages that meet **every** target while changing your recipe **as little as possible**. Locked ingredients stay exactly as they are.',
        },
        {
          type: 'steps',
          items: [
            'Optionally click `Limits` to give ingredients a **Min %** and **Max %**, for example “sweetener at most 2%” or “oats at least 40%”. Leave a box blank for no limit, then click `Apply`. The button shows how many ingredients have limits.',
            'Click `Save` first. Solve works from the saved recipe, so it asks you to save if you haven’t.',
            'Click `Solve` (it only appears when the project has targets).',
            'Read the **LP Solver** panel. **Suggested Weights** compares the current % with the suggested %. **Constraint Audit** shows whether each target is satisfied.',
            'If you like the result, click `Apply solution`, then click `Save`.',
          ],
        },
        {
          type: 'terms',
          items: [
            { term: '“No feasible solution”', text: 'No mix of these ingredients can meet every target at once within your limits. Loosen a target or a limit, add a different ingredient, or unlock some ingredients.' },
            { term: '“All ingredients are locked”', text: 'Unlock at least one ingredient so Solve has something to change.' },
            { term: '“No weights entered in formulation.”', text: 'Enter amounts and save first.' },
          ],
        },
        {
          type: 'tip',
          text: 'Set the formulation’s **Serving (g)** before using Solve with per-serving targets.',
        },
      ],
    },
    {
      slug: 'versions',
      title: 'Versions: iterations, copies, finalizing and archiving',
      summary: 'Try changes without losing earlier versions, and lock finished recipes.',
      blocks: [
        {
          type: 'p',
          text: 'Each formulation can have many **iterations** (versions): v1, v2, v3 and so on. They share a name, but each has its own ingredients and settings. The project shows the newest one.',
        },
        { type: 'h', text: 'Making a new version or a copy' },
        {
          type: 'steps',
          items: [
            'Click `Save` first. Copies are made from the saved recipe, so Benchtop asks you to save if you haven’t.',
            'Click `Duplicate`.',
            'Choose **New iteration** to make the next version of this formulation (for example v4), or **New formulation** to make a separate formulation with a new name, starting at v1, in the same project.',
            'The copy opens straight away as a **draft** you can edit.',
          ],
        },
        {
          type: 'p',
          text: 'Copies include the ingredients, amounts, locks, Solve limits, batch and serving size, process steps and nutrient columns. They don’t include the version note, saved Nutrition Facts panels or the COGS unit size.',
        },
        { type: 'h', text: 'Switching versions and describing them' },
        {
          type: 'list',
          items: [
            'Use the version dropdown next to the name to open another version. The newest is marked “(latest)” and finalized ones show 🔒.',
            'Type a short note in **How is this iteration different?**, such as “less sugar, more fiber”. It saves when you click away and shows in the version list, which makes versions easy to tell apart.',
            'Click `Compare` (next to the version dropdown) to see two saved versions side by side: batch and finished weight, serving size, each ingredient’s grams and % (added ones in green, removed ones in red) and the nutrition per 100 g finished. Pick the two versions at the top; **Only show changes** hides rows that are the same.',
          ],
        },
        { type: 'h', text: 'Finalizing (locking) a version' },
        {
          type: 'p',
          text: 'When a version is approved, click `Finalize`, then `Finalize & lock`. It becomes **locked** so nobody changes it by accident. You can still print it, make Nutrition Facts panels, duplicate it, record batches and save it as an ingredient. To change it, either click `Unlock` (`Yes, unlock`) or, better, make a **New iteration** so the approved version stays as it was.',
        },
        { type: 'h', text: 'Renaming and archiving' },
        {
          type: 'list',
          items: [
            '**Rename:** move your mouse over the name and click the pencil. The new name applies to every version.',
            '**Archive:** click `Archive`, then `Yes, archive`. All versions are hidden from the project. To bring them back, open the project, click `Archived (N)`, then `Restore`.',
            'Formulations can’t be deleted, only archived.',
          ],
        },
      ],
    },
    {
      slug: 'nfp',
      title: 'Making a Nutrition Facts panel (NFP)',
      summary: 'Create an FDA-style label and download it as PNG, JPG or PDF.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Set **Serving (g)** in the grey bar. Without it, the panel shows values per 100 g.',
            'Click `NFP`. The **Nutrition Facts Panel** window opens, with options on the left and a live preview on the right.',
            'Choose a **Layout**: **Standard (vertical)** for most packages, **Tabular** (side by side) when there isn’t room for vertical, or **Linear** (one paragraph) for very small packages.',
            'Pick the options you want (explained below).',
            'Choose a **Download format** (PNG, JPG or PDF) and click `Download`, or click `Print`.',
          ],
        },
        {
          type: 'terms',
          items: [
            { term: 'Hide nutrients that round to zero', text: 'Leaves out lines that would show 0.' },
            { term: 'Include additional nutrients', text: 'Adds extra vitamins, minerals and other nutrients that your ingredients contain. Tick the ones you want.' },
            { term: 'Include allergen statement', text: 'Adds a “Contains:” line built from your ingredients’ allergens. You can edit the text.' },
            { term: 'Include ingredient statement', text: 'Adds the “INGREDIENTS:” list. See [The ingredient statement](#ingredient-statement).' },
          ],
        },
        { type: 'h', text: 'How values are rounded' },
        {
          type: 'p',
          text: 'The panel follows the FDA’s rounding rules (21 CFR 101.9). For example, calories round to the nearest 5 up to 50 and to the nearest 10 above that; fat under 0.5 g shows as 0; protein between 0.5 g and 1 g shows as “<1g”. Hover over a dotted value in the preview to see which rule was used. Open **FDA rounding rules applied to this panel** for the full list.',
        },
        {
          type: 'p',
          text: '**Servings per container** is the finished weight (the batch weight after process losses such as baking or trim) divided by the serving size, rounded the FDA way (with “about” when rounded).',
        },
        { type: 'h', text: 'Saving an approved panel' },
        {
          type: 'p',
          text: 'Under **Saved to v…**, give the panel a name (such as “Retail label Oct 2026”) and click `Save`. Saved panels are frozen exactly as shown, so they never change even if ingredient data is updated later. Click the eye icon to view one again (Download and Print then use that saved version), or the trash can to delete it. Each version can hold up to 50 saved panels.',
        },
        {
          type: 'warning',
          text: 'The panel is a strong starting point, but you are responsible for your label. Confirm it against current FDA regulations before printing commercial packaging.',
        },
      ],
    },
    {
      slug: 'ingredient-statement',
      title: 'The ingredient statement and allergen statement',
      summary: 'Arrange the “INGREDIENTS:” list for your label.',
      blocks: [
        {
          type: 'p',
          text: 'In the NFP window, tick **Include ingredient statement**. Benchtop lists your ingredients **heaviest first**, using each ingredient’s **label name** (set on the ingredient’s page) and putting its sub-ingredients in parentheses.',
        },
        {
          type: 'list',
          items: [
            '**Reorder:** drag an ingredient above or below another.',
            '**Combine into parentheses:** drag an ingredient onto the middle of another, then name the group. For example, “Chocolate Chips (sugar, cocoa butter)”.',
            '**Rename for this label only:** click a name and type. This doesn’t change the ingredient in your library.',
            '**Separate a group:** use the ungroup icon.',
            'If you move things out of weight order, Benchtop warns “Not in descending order by weight.” Click `Sort by weight` to fix it. **Reset from formulation** starts over.',
            '**Edit as text** lets you type the whole statement freely.',
          ],
        },
        {
          type: 'p',
          text: 'The **allergen statement** is built from the allergens recorded on each ingredient that’s in the recipe. Edit the text if needed; it prints after “Contains:”. Keep allergens up to date on each ingredient’s page so this is right. See [Allergens and certifications](/help/ingredients#allergens).',
        },
        {
          type: 'note',
          text: 'Regulations require ingredients in descending order by weight. Only reorder if you know the rule allows it.',
        },
      ],
    },
    {
      slug: 'print',
      title: 'Printing a formulation sheet',
      summary: 'Print the recipe, method and checks for the lab or production.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Click `Save` first. Printing uses the last saved version.',
            'Click `Print`.',
            'Choose what to include: **Formulation** (ingredients and settings), **Process steps**, **Full nutrient profile**, and **Validation vs project targets**.',
            'Click `Print`. A print-friendly page opens in a new tab. (If nothing opens, allow pop-ups for Benchtop in your browser.)',
            'Click `Print` on that page, or choose “Save as PDF” in your browser’s print window.',
          ],
        },
        {
          type: 'tip',
          text: 'Process steps print with **empty boxes** for start and end time, pH, temperature, time, speed and equipment, so the person at the bench can fill them in by hand.',
        },
      ],
    },
    {
      slug: 'complete-batch',
      title: 'Recording a completed batch (stock)',
      summary: 'Take the ingredients you used out of your stock levels.',
      blocks: [
        {
          type: 'p',
          text: 'When you actually make a batch, `Complete batch` subtracts the amounts used from each ingredient’s **Stock** (only for ingredients where you track stock; see [Stock and on-hand](/help/ingredients#stock)).',
        },
        {
          type: 'steps',
          items: [
            'Save the formulation, then click `Complete batch`.',
            'Set the **Batch multiplier**. 1 means you made exactly the saved batch; 2 means double; 0.5 means half.',
            'Optionally add **Notes**, such as “Trial batch for sampling”.',
            'Optionally click `Preview` to see how much stock each tracked ingredient will have left. Anything that would go below zero shows in red.',
            'Click `Complete batch`. You’ll see how many stock levels were updated.',
          ],
        },
        {
          type: 'p',
          text: 'Every completed batch is listed under **Batch history**, below the process steps, with its date, multiplier, batch weight, who recorded it and your notes. Click the heading to open it. Each version keeps its own history.',
        },
        {
          type: 'warning',
          text: 'Benchtop doesn’t stop you completing a batch when there isn’t enough stock (Preview warns you), so stock can go below zero. Recorded batches can’t be undone from the app; fix any mistake by correcting the stock on the ingredient’s page.',
        },
      ],
    },
    {
      slug: 'save-as-ingredient',
      title: 'Using a formulation as an ingredient in another recipe',
      summary: 'Turn a finished recipe (like a sauce or a premix) into a library ingredient.',
      blocks: [
        {
          type: 'p',
          text: 'Sometimes one recipe goes into another, such as a spice blend or a caramel sauce. You can save a finished formulation as an ingredient.',
        },
        {
          type: 'steps',
          items: [
            'Finalize the version first (`Finalize` → `Finalize & lock`).',
            'Click `Save as ingredient`.',
            'Check the **Ingredient name** and click `Save ingredient`.',
          ],
        },
        {
          type: 'p',
          text: 'Benchtop copies the nutrition per 100 g of **finished** product (after process losses), all the allergens, the ingredient list (for your label) and, if every ingredient has a cost, the cost per kg (worked out the same way as the **COGS** tab, using each ingredient’s chosen supplier price or its manual cost). It’s a **snapshot**: later changes to the formulation don’t change the ingredient. To refresh it, open the same version and click `Save as ingredient` → `Update ingredient`.',
        },
        {
          type: 'note',
          text: 'The cost is only filled in when every ingredient has a cost typed in on its Cost tab. Supplier prices chosen for costing aren’t used here.',
        },
      ],
    },
    {
      slug: 'cogs',
      title: 'Raw material cost (COGS)',
      summary: 'See what a batch, a kilo, a serving or a package costs in ingredients.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Turn it on: [Settings → Preferences](/settings/preferences) → **Show COGS on formulations**.',
            'Give your ingredients a cost on each one’s **Cost** tab. See [Ingredient costs](/help/ingredients#cost).',
            'Open a formulation and click the **COGS** tab above the grid.',
          ],
        },
        {
          type: 'terms',
          items: [
            { term: 'Per batch', text: 'The total ingredient cost of the batch.' },
            { term: 'Per kg (or lb) finished', text: 'Batch cost ÷ the finished weight after losses.' },
            { term: 'Per serving', text: 'Needs a serving size on the Formula tab.' },
            { term: 'Per unit', text: 'The cost of one sellable package. Type the package’s finished weight in **Unit / package size (g)**.' },
          ],
        },
        {
          type: 'p',
          text: 'Use the **Show:** buttons to pick which totals appear, and **kg / lb** to switch units. Both are remembered for you. The table lists every ingredient with its quantity, cost per kg or lb, batch cost, and share of the total, with the most expensive at the top.',
        },
        {
          type: 'list',
          items: [
            'If some ingredients have no cost, they’re listed in a yellow warning with links, and totals are marked “(partial)”.',
            'Because per-kg, per-serving and per-unit costs divide by the **finished** weight, process losses make them higher.',
            'This is **raw materials only**: packaging, labour and overhead aren’t included.',
            'The COGS tab uses what’s on screen, including unsaved changes.',
          ],
        },
      ],
    },
    {
      slug: 'reverse',
      title: 'Reverse engineering a product from its label',
      summary: 'Start from a competitor’s or a target label and let Benchtop work out a matching recipe.',
      blocks: [
        {
          type: 'p',
          text: 'Use this when you want to match an existing product. Create a formulation with Mode **Reverse engineer — match a target label** (see [The Formulations list](/help/projects#formulations-in-project)). The **Reverse-engineer wizard** opens automatically. You can reopen it any time with the `Reverse wizard` button. It has five steps:',
        },
        {
          type: 'steps',
          items: [
            '**Start.** Choose **Upload product label** (AI reads photos of the label) or **Enter manually**.',
            '**Label data.** Upload 1 to 4 photos (JPG, PNG or WebP, up to 12 MB each) of the nutrition panel and ingredient list and click `Parse with AI`, or type the information in. Check the **Product name**, **Serving size (g)**, **Batch to produce (g)**, the **Nutritional panel (per serving)** values, the **Ingredient deck** (the ingredient list, which you can paste and split with **Parse into ingredient list**), and any **Label claims**. Click `Next: link ingredients`.',
            '**Link ingredients.** For each ingredient on the label, connect it to nutrition data: **Library** (your ingredients), **USDA**, **URL** (a web page with nutrition facts), **New** (add it to your library), or **Skip**. You can set min and max % **Bounds** for each, and add extra ingredients the label doesn’t list. Then click `Run AI research`.',
            '**AI research.** Benchtop’s AI suggests the product category, matches from what you have on hand, likely % ranges (applied to the bounds), and ways to link anything still unlinked (USDA, URL, typing values, or uploading a spec sheet). Click `Proceed to solve`.',
            '**Solve.** Click `Run solver`. Benchtop finds the percentages whose nutrition comes closest to the label, and shows a comparison (green within 5%, yellow 5–20%, red over 20%). Click `Apply to formulation`.',
          ],
        },
        {
          type: 'warning',
          text: '`Apply to formulation` **replaces** all the ingredients in the formulation with the result, and it is **not saved** until you click `Save`. Also set **Serving (g)** yourself afterwards.',
        },
        {
          type: 'tip',
          text: 'You can stop part way: click `Save as draft`, and next time you open the wizard click `Resume`. Photos aren’t kept, but everything read from them is.',
        },
        {
          type: 'note',
          text: 'Ingredients you add or import while linking go into your library straight away, even if you don’t finish. Adding new library ingredients needs edit access to the ingredient library. AI results can be wrong, so always check them.',
        },
      ],
    },
    {
      slug: 'import',
      title: 'Importing a formulation from Excel or CSV',
      summary: 'Turn a recipe you keep in a spreadsheet into a Benchtop formulation.',
      blocks: [
        {
          type: 'p',
          text: 'If you already keep formulations in spreadsheets, you don’t have to type them in again. Upload the file, and Benchtop reads it and builds a matching formulation for you to check. Nothing is added to your account until you click `Create formulation`.',
        },
        {
          type: 'steps',
          items: [
            'On [Projects](/projects), click `Import formulation`. (Or click `Import` on a project page, and the formulation goes into that project.)',
            'Drop an Excel workbook (.xlsx) or a CSV file on the page, or click to choose one. Reading it can take up to a minute.',
            'If the file holds several formulations (for example one per sheet), choose the one to import. You can come back for the others.',
            'Check the **Formulation** details: name, serving size, batch size and notes.',
            'Choose the **Project**, create a new one on the spot (with its client), or click **Skip for now**.',
            'Go through the **Ingredients**. Each row shows what the file says and the ingredient it’s linked to in your library (see below).',
            'Untick any **Process steps** you don’t want, and fix their wording if needed.',
            'Click `Create formulation`. It opens as version 1, with the version note “Imported from” and the file name.',
          ],
        },
        { type: 'h', text: 'Linking ingredients' },
        {
          type: 'terms',
          items: [
            { term: 'Green tick', text: 'Linked to an ingredient in your library with the same name (or the same item code). Click `Change` if it’s the wrong one.' },
            { term: 'Did you mean…', text: 'Close matches from your library. Click one to link it. When there are several rows like this, **Use the first suggestion for all** links them in one go; check the result.' },
            { term: 'Not in your library', text: 'Click `Pick from library` to choose one yourself, or `Add new ingredient` to add it now from USDA or by typing its details, without leaving the import. Other rows with the same name are linked at the same time.' },
            { term: 'Skip for now', text: 'Leave it for later, for example while you wait for a spec sheet. The import can then only be saved as a draft.' },
            { term: '✕ (leave out)', text: 'For rows that aren’t ingredients, such as a total or a note. They’re ignored. Click the arrow to bring a row back.' },
          ],
        },
        {
          type: 'p',
          text: 'Amounts can be in **g**, **kg**, **mg**, **lb**, **oz** or **%**. Fix any amount or unit that was read wrongly; a red box means it’s missing. Amounts in mL, cups or pieces can’t be converted, so enter them in grams. When the file gives only percentages, Benchtop needs a **Batch size** to turn them into grams; if the file doesn’t give one it starts at 1,000 g. If two rows link to the same ingredient, they’re combined into one line.',
        },
        { type: 'h', text: 'Saving a draft' },
        {
          type: 'p',
          text: 'The bar at the bottom lists what’s **Still needed**: a name, a project, an ingredient for every row, and a usable amount for every row (plus a batch size for percentages). Until all of those are there, `Create formulation` stays greyed out, but you can click `Save as draft` at any time. Optional items (serving size, the client, percentages that don’t add up to 100%) are listed but don’t stop you.',
        },
        {
          type: 'p',
          text: 'A draft isn’t a formulation yet. Your drafts are listed under **Unfinished imports** on the import page, and the Projects page reminds you about them. If you chose or created a project before saving, the draft is also listed under **Unfinished imports** on that project’s page. Click `Continue` to pick up where you left off, then `Create formulation` once everything is filled in. Drafts are private to you.',
        },
        {
          type: 'note',
          text: 'Adding ingredients needs edit access to the ingredient library, and creating a project needs permission to create projects. Without them those buttons don’t appear; pick existing ones, or ask an owner or admin.',
        },
        {
          type: 'tip',
          text: 'Old Excel files (.xls) can’t be read. Open the file in Excel and save it as .xlsx or .csv first. Hidden sheets are ignored.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'Can I import formulations I keep in Excel?',
      a: 'Yes. Click `Import formulation` on [Projects](/projects) and upload the .xlsx or .csv file. Benchtop builds a matching formulation for you to check before it’s saved. See [Importing a formulation from Excel or CSV](/help/formulations#import).',
    },
    {
      q: 'An ingredient in my spreadsheet isn’t in my library. What do I do?',
      a: 'On the import page, click `Add new ingredient` on that row to add it from USDA or by typing its details, without leaving the import. Or click `Skip for now` and save the import as a draft to finish later.',
    },
    {
      q: 'Where did my unfinished import go?',
      a: 'Click `Import formulation` on [Projects](/projects). Your drafts are listed under **Unfinished imports**; click `Continue`. If the draft already has a project, it’s also listed on that project’s page. It becomes a formulation in the project once you click `Create formulation`.',
    },
    {
      q: 'I made changes and they disappeared. What happened?',
      a: 'Ingredient grid changes only save when you click the blue `Save` button. Benchtop asks before you leave with unsaved changes, but if you choose to leave anyway (or the browser closes), they’re lost. Process steps, notes and column choices save on their own.',
    },
    {
      q: 'How do I scale my recipe to a bigger batch?',
      a: 'Type the new total in **Batch (g)** and press Enter. Everything scales in proportion. Then click `Save`. To keep one version at lab size, duplicate it first.',
    },
    {
      q: 'Why did the number I typed change by itself?',
      a: 'The batch size is locked and there wasn’t room for that amount, so Benchtop used the biggest amount that fits. Unlock the batch (padlock next to **Batch (g)**) to change the total freely.',
    },
    {
      q: 'What’s the difference between the weight lock and the % lock?',
      a: 'The weight lock keeps the grams the same. The % lock keeps the ingredient at the same share of the batch, so its grams change when the batch size changes.',
    },
    {
      q: 'Why is the Total row different from adding up the column?',
      a: 'For nutrients, the Total row shows the amount per 100 g of finished product. The cells above show how much each ingredient adds to the whole batch.',
    },
    {
      q: 'Why did protein per 100 g go up when I added a baking step?',
      a: 'You entered a **moisture loss**. Water leaves but the protein stays, so each gram is more concentrated. A **production loss** wouldn’t change per-100 g values.',
    },
    {
      q: 'Is a “% of batch” loss based on the starting batch?',
      a: 'No, it’s based on the weight going into that step, after any earlier losses.',
    },
    {
      q: 'Why does my nutrition look too low?',
      a: 'Probably an ingredient is missing data for that nutrient, which counts as zero. Open **Full nutrient profile**, click the nutrient, and check which ingredients show nothing. Then add their values on the ingredient’s page.',
    },
    {
      q: 'Why can’t I add the same ingredient twice?',
      a: 'Each ingredient can only appear once in a formulation. Increase its amount instead.',
    },
    {
      q: 'What’s the difference between “New iteration” and “New formulation”?',
      a: 'A new iteration is the next version (v2, v3…) of the same formulation. A new formulation is a separate copy with a different name that starts at v1. Both start as editable drafts.',
    },
    {
      q: 'Duplicate says “Save your changes first.”',
      a: 'Copies are made from the saved recipe. Click `Save`, then `Duplicate` again.',
    },
    {
      q: 'How do I edit a finalized (locked) formulation?',
      a: 'Click `Unlock` and confirm. Or better, use `Duplicate` → **New iteration** to make an editable copy and keep the approved version unchanged.',
    },
    {
      q: 'How do I delete a formulation or one version?',
      a: 'You can’t delete them, but you can `Archive` a formulation (all versions at once) and `Restore` it later from the project’s **Archived** list.',
    },
    {
      q: 'Can I compare two versions side by side?',
      a: 'Yes. Click `Compare` next to the version dropdown and pick the two versions. It compares what was last saved in each, so save first if you’ve made changes.',
    },
    {
      q: 'Why does my Nutrition Facts panel say “Amount per 100g”?',
      a: 'The formulation has no serving size. Enter one in **Serving (g)** in the grey bar.',
    },
    {
      q: 'Why does my label say “<1g”?',
      a: 'That’s the FDA rule: amounts from 0.5 g to just under 1 g are shown as “less than 1 gram”. Hover the dotted value in the preview to see the rule.',
    },
    {
      q: 'How is “servings per container” worked out?',
      a: 'The finished weight (after the process losses on the Process tab) divided by the serving size, rounded the FDA way. With no process losses that’s simply the batch weight.',
    },
    {
      q: 'Will a saved Nutrition Facts panel change if I edit an ingredient later?',
      a: 'No. Saved panels are frozen exactly as they were. Only the live panel updates.',
    },
    {
      q: 'Where does the allergen statement come from?',
      a: 'From the allergens recorded on each ingredient in the recipe. Keep each ingredient’s allergens up to date, and you can edit the text in the NFP window.',
    },
    {
      q: 'My printout doesn’t show my latest changes.',
      a: 'Printing uses the last saved version. Click `Save`, then print again.',
    },
    {
      q: 'Print didn’t open anything.',
      a: 'The print page opens in a new tab. Allow pop-ups for Benchtop in your browser and try again.',
    },
    {
      q: 'What does Solve do?',
      a: 'It suggests new amounts that meet every project target while changing your recipe as little as possible, keeping locked ingredients fixed. Review the suggestion, click `Apply solution`, then `Save`.',
    },
    {
      q: 'I don’t see the Solve button.',
      a: 'It only appears when the project has nutritional targets, the formulation has ingredients, and you have edit access.',
    },
    {
      q: 'Solve says “No feasible solution.”',
      a: 'No mix of your current ingredients meets every target at once within your `Limits`. Loosen a target or a limit, add an ingredient that helps (for example a protein isolate for a protein target), or unlock ingredients.',
    },
    {
      q: 'Can I stop Solve using too much (or too little) of an ingredient?',
      a: 'Yes. Click `Limits` next to `Solve`, enter a **Min %** and/or **Max %** for that ingredient, click `Apply`, then `Save` and `Solve`. Limits are saved with the formulation and copied when you duplicate it.',
    },
    {
      q: 'How do I use one of my recipes inside another?',
      a: 'Finalize it, then click `Save as ingredient`. It appears in your ingredient library and you can add it to other formulations.',
    },
    {
      q: 'Why is the cost blank on an ingredient I saved from a formulation?',
      a: 'At least one ingredient in it has no cost: no supplier price chosen for costing (in a weight unit) and no manual cost on its Cost tab. The formulation’s **COGS** tab shows which ones.',
    },
    {
      q: 'Why don’t I see the COGS tab?',
      a: 'Turn it on in [Settings → Preferences](/settings/preferences). It’s a personal setting.',
    },
    {
      q: 'Why are my per-serving and per-kg costs higher than I expected?',
      a: 'They’re based on the finished weight. Process losses mean less finished product from the same ingredients, so each kilo or serving costs more.',
    },
    {
      q: 'Where’s the Reverse wizard button?',
      a: 'It’s only on formulations created in **Reverse engineer** mode. The mode can’t be changed, so create a new formulation in Reverse mode.',
    },
    {
      q: 'I applied the reverse wizard result but it’s gone.',
      a: '`Apply to formulation` only fills in the grid. Click `Save` to keep it.',
    },
    {
      q: 'Why is “Run AI research” greyed out?',
      a: 'Link at least one label ingredient (or add an extra ingredient) first.',
    },
    {
      q: 'Where can I see the batches I’ve made?',
      a: 'Open the formulation version you made them from and click **Batch history** below the process steps. It only appears once a batch has been completed for that version.',
    },
    {
      q: 'Does Complete batch check I have enough stock?',
      a: 'It doesn’t stop you, but `Preview` shows what each tracked ingredient will have left and warns in red when stock would go below zero. Adjust stock on the ingredient’s page if needed.',
    },
    {
      q: 'Can I record pH, temperature and mixing time?',
      a: 'Yes. Every process step has boxes for start and end time, pH, temperature (°C or °F), time, speed, equipment and notes, plus solids, shear and pressure under the step’s arrow.',
    },
  ],
}
