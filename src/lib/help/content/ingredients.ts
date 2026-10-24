import type { HelpSection } from '../types'

export const ingredients: HelpSection = {
  slug: 'ingredients',
  title: 'Ingredients',
  icon: 'flask',
  intro:
    'Your ingredient library holds every raw material you use, with its nutrition, allergens, certifications, documents, suppliers, cost and stock. Everyone on your account shares the same library. This section covers every way to add ingredients, how to keep them accurate, and Lab Intake for logging a whole shelf at once.',
  articles: [
    {
      slug: 'library',
      title: 'The Ingredient Directory',
      summary: 'Find, filter and sort your ingredients.',
      blocks: [
        {
          type: 'p',
          text: 'Click [Ingredients](/ingredients) in the menu. Click any row to open that ingredient’s page.',
        },
        {
          type: 'terms',
          items: [
            { term: 'Filter ingredients…', text: 'Type to narrow the list as you type.' },
            { term: 'All categories', text: 'Show only one category, or **Uncategorized**.' },
            { term: 'On hand only', text: 'Show only what’s physically in your lab.' },
            { term: 'Column headers', text: 'Click **Name**, **Category** or **Formulations** to sort; click again to reverse.' },
          ],
        },
        { type: 'h', text: 'What the columns mean' },
        {
          type: 'terms',
          items: [
            { term: 'Name', text: 'Plus a green **On hand** badge, and a yellow **Duplicate — rename or merge** button if it clashes with another entry.' },
            { term: 'Category', text: 'Its category path, such as Starches › Tapioca › Native.' },
            { term: 'Source', text: 'Where the data came from: **USDA** (USDA database), **Manual** (typed in, or from Lab Intake), **Supplier** (supplier web page or spec sheet), **AI** (read from photos), or **Formulation** (saved from one of your recipes).' },
            { term: 'Verified', text: 'Whether someone has checked the data. See [Verifying ingredients](#verify).' },
            { term: 'FDC ID', text: 'The USDA FoodData Central ID, if it came from USDA.' },
            { term: 'Stock', text: 'Grams in stock if you track it (red means below zero), or — if not.' },
            { term: 'Formulations', text: 'How many formulations use it.' },
            { term: 'Pencil / trash', text: 'Quick edit, or delete.' },
          ],
        },
        {
          type: 'note',
          text: 'On a phone only Name and Verified are shown. The list shows up to the 500 most recently added ingredients. If you can’t find an older one, search for it by name.',
        },
      ],
    },
    {
      slug: 'add-manual',
      title: 'Adding an ingredient by hand',
      summary: 'Type an ingredient in, then add its nutrition.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Ingredients](/ingredients), click `Add`. Stay on the **Manual entry** tab.',
            'Type the **Name**, such as “Organic Rolled Oats”. This is the only required field.',
            'Optionally fill in **Preferred name on ingredient deck** (how it should read on your label, such as “Rolled Oats”), **Brand name**, **Supplier**, **Item code**, **Source type**, **Naturally derived**, **Cost / kg ($)**, **Moisture %** and **Notes**.',
            'Click `Add ingredient`.',
            'Open the new ingredient and add its nutrition on the **Nutrients** tab. See [Entering nutrition values](#nutrients).',
          ],
        },
        {
          type: 'warning',
          text: '**Notes**, **Naturally derived** and **Moisture %** can only be set here, when you create the ingredient; there is no screen to change them later. Fill them in carefully.',
        },
        {
          type: 'note',
          text: 'The **Supplier** box here is just text, part of what makes this ingredient unique. To record a supplier’s price and pack size, link a supplier record on the ingredient’s **Suppliers** tab instead. See [Linking suppliers and prices](#suppliers-tab).',
        },
      ],
    },
    {
      slug: 'add-usda',
      title: 'Importing an ingredient from the USDA database',
      summary: 'The fastest way to get complete, reliable nutrition for common foods.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Ingredients](/ingredients), click `Search USDA`.',
            'Type what you’re looking for, such as “oat flour” or “sunflower oil”. Results appear as you type, 25 per page.',
            'Click a result to preview it. Prefer results marked **Foundation** or **SR Legacy**; they’re the most complete and reliable.',
            'Optionally type a different name in **Import as**.',
            'Click `Import ingredient`. You’ll see how many nutrients were brought in.',
          ],
        },
        {
          type: 'p',
          text: 'USDA ingredients arrive **Verified**, with nutrition per 100 g, and each value is labelled with its USDA source. If you see “USDA rate limit reached”, wait a minute and try again.',
        },
      ],
    },
    {
      slug: 'add-photos',
      title: 'Adding an ingredient from photos',
      summary: 'Take pictures of the package and let AI fill it in.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Ingredients](/ingredients), click `Scan photos`.',
            'Add up to 3 photos: the **Product Label**, the **Nutrition Facts Panel**, and the **Ingredient Deck** (the ingredient list). On a phone, each slot opens the camera.',
            'Click `Analyze with AI`. It usually takes 5–10 seconds.',
            'Check the **Product name** and **Label name**, set **Naturally derived**, and optionally enter **Opening stock (g)** to start tracking stock.',
            'Click `Add to inventory`.',
            'Open the new ingredient and check its nutrients, allergens, certifications and sub-ingredients carefully.',
          ],
        },
        {
          type: 'tip',
          text: 'Use sharp, well-lit, straight-on photos. AI can misread blurry or curved labels, which is why these ingredients start as **Unverified**.',
        },
      ],
    },
    {
      slug: 'add-url',
      title: 'Adding an ingredient from a supplier’s web page',
      summary: 'Pull nutrition from a product page online.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Ingredients](/ingredients), click `Add`, then the **From supplier URL** tab.',
            'Type the **Ingredient name** first.',
            'Paste the **Supplier product URL** and click `Fetch nutrition`.',
            'Check the nutrients it found (shown per 100 g).',
            'Click `Add ingredient`.',
          ],
        },
        {
          type: 'note',
          text: 'Only the main label nutrients are read. Some websites block this or build their pages in a way it can’t read; if so, you’ll see an error, and you should use manual entry or a spec sheet instead. **Total sugars aren’t saved from web pages**, so add that value by hand afterwards.',
        },
      ],
    },
    {
      slug: 'nutrients',
      title: 'Entering and editing nutrition values',
      summary: 'Type values in, or read them from a spec sheet with AI.',
      blocks: [
        {
          type: 'p',
          text: 'All nutrition is stored **per 100 g of the ingredient as you buy it**, in the unit shown next to each nutrient (for example g for protein, mg for sodium, mcg for vitamin D).',
        },
        { type: 'h', text: 'Typing values' },
        {
          type: 'steps',
          items: [
            'Open the ingredient and go to the **Nutrients** tab. Click `Edit nutrients`.',
            'At the top, type a **Source reference**, which says where the numbers came from, such as “Supplier COA Q2-2024”. This is required.',
            'Type each value per 100 g in the unit shown. Use **×** to clear a value.',
            'Click `Save nutrients`.',
          ],
        },
        { type: 'h', text: 'Reading values from a spec sheet or COA' },
        {
          type: 'steps',
          items: [
            'Upload the spec sheet or COA on the **Documents** tab first (PDF or image). See [Documents](#documents).',
            'On the **Nutrients** tab, click `Edit nutrients`.',
            'Under **Parse from document**, choose the document and click `Parse with AI`.',
            'Check every value it filled in, fix anything wrong, then click `Save nutrients`. Nothing is saved until you click it.',
          ],
        },
        { type: 'h', text: 'Converting label values' },
        {
          type: 'list',
          items: [
            'If your document gives values **per serving**, convert to per 100 g: value ÷ serving size in grams × 100. Example: 5 g protein in a 30 g serving is 5 ÷ 30 × 100 = 16.7 g per 100 g.',
            '1 g = 1,000 mg = 1,000,000 mcg. Example: a powder with 125 mcg vitamin D in 50 mg of powder has 250,000 mcg per 100 g.',
            '**IU can’t be entered.** Convert IU to the unit shown first (for example, vitamin D: 40 IU = 1 mcg).',
          ],
        },
        {
          type: 'note',
          text: 'Changing a value that already had a source keeps its old source note. You can also edit nutrients from inside a formulation by clicking the ingredient’s name; that changes the library ingredient everywhere it’s used.',
        },
      ],
    },
    {
      slug: 'details',
      title: 'Editing name, label name, brand, category and on-hand',
      summary: 'Where to change each detail of an ingredient.',
      blocks: [
        { type: 'h', text: 'On the ingredient’s page' },
        {
          type: 'p',
          text: 'Move your mouse over the **name**, the **Label:** line, or the **Brand / Supplier / Item #** line at the top of the page. A small pencil appears; click it, edit, and click `Save`. (On a touch screen, tap just to the right of the text to find the pencil.)',
        },
        { type: 'h', text: 'Category and On hand (from the list)' },
        {
          type: 'steps',
          items: [
            'On [Ingredients](/ingredients), click the **pencil** at the end of the ingredient’s row.',
            'Choose a **Category**, then optionally a **Subcategory** and **Micro category**. Choose **Add new…** to create your own.',
            'Tick **On hand in the lab** if you have it, and optionally enter **Stock on hand (g)**.',
            'Click `Save`.',
          ],
        },
        {
          type: 'p',
          text: 'Categories have three levels, such as **Starches › Tapioca › Native**. benchtop comes with 20 standard categories (Proteins, Sweeteners, Fats & Oils, Hydrocolloids & Gums and so on). Categories you add become available to everyone on your account.',
        },
        { type: 'h', text: 'Automatic capitalization' },
        {
          type: 'p',
          text: 'benchtop capitalizes every word of an ingredient’s name so your library looks consistent: “tapioca starch, native” becomes “Tapioca Starch, Native”. Common abbreviations stay in capitals (MCT, DATEM, WPI, GMO and so on), words you already capitalized such as “pH” or “McCormick” are left alone, and units after numbers stay lowercase (“500 mg”).',
        },
      ],
    },
    {
      slug: 'allergens',
      title: 'Allergens, certifications and sub-ingredients',
      summary: 'Information that feeds your label and allergen statement.',
      blocks: [
        { type: 'h', text: 'Allergens' },
        {
          type: 'steps',
          items: [
            'Open the ingredient and go to the **Allergens** tab.',
            'Click each allergen it contains: Milk, Eggs, Fish, Shellfish, Tree Nuts, Peanuts, Wheat, Soybeans, Sesame or Gluten. Selected ones turn orange with a ✓. Click again to remove.',
            'For anything else, type it in **Add custom allergen…** and click `Add`.',
          ],
        },
        { type: 'h', text: 'Certifications' },
        {
          type: 'p',
          text: 'On the **Certifications** tab, click Organic, Non-GMO, IP Non-GMO, Kosher, Halal, Vegan, Gluten-Free or Fair Trade, or add a custom one.',
        },
        { type: 'h', text: 'Sub-ingredients' },
        {
          type: 'p',
          text: 'For ingredients that are themselves a mix (such as chocolate chips: sugar, cocoa butter, …), open the **Sub-ingredients** tab, click `Edit list`, type one sub-ingredient per line in label order, and click `Save`. They appear in parentheses in your formulation’s ingredient statement.',
        },
        {
          type: 'warning',
          text: 'Your formulation’s allergen statement and ingredient statement are built from this information, so keep it accurate.',
        },
      ],
    },
    {
      slug: 'documents',
      title: 'Documents (spec sheets, COAs)',
      summary: 'Store files with each ingredient.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Open the ingredient and go to the **Documents** tab.',
            'Choose the file. PDF, Word, Excel, CSV, PNG, JPG and WebP are accepted, up to 20 MB.',
            'Type a **Label**, such as “Spec Sheet” or “COA 2026-Q2”. This is required.',
            'Click `Upload`.',
          ],
        },
        {
          type: 'p',
          text: 'Click `View` to open a document (the link works for a few minutes), or `Delete` to remove it. PDFs and images can be read by AI to fill in nutrition (see [Entering nutrition values](#nutrients)).',
        },
      ],
    },
    {
      slug: 'suppliers-tab',
      title: 'Linking suppliers and prices to an ingredient',
      summary: 'Record who sells it, the pack size and the price.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Open the ingredient and go to the **Suppliers** tab. Click **Link a supplier →**.',
            'Choose the **Supplier**, or **+ New supplier…** to create one on the spot.',
            'Enter the **Pack size** and **Unit** (kg, g, lb, oz, mt, case, bag, drum, pail, each, L or gal).',
            'Enter the **Cost / unit ($)**. This is the price for **one unit**, such as $ per kg or $ per bag, not for the whole pack.',
            'Optionally tick **Mark as preferred supplier** (shown with a star).',
            'Click `Link supplier`.',
          ],
        },
        {
          type: 'tip',
          text: 'Leave pack size or cost **blank** if you don’t know them. Don’t type 0.',
        },
        {
          type: 'p',
          text: 'Use the pencil to edit a link and the trash can to remove it. You can link the same supplier twice (for example for two pack sizes).',
        },
      ],
    },
    {
      slug: 'cost',
      title: 'Ingredient costs',
      summary: 'Give an ingredient a cost so formulations can show COGS.',
      blocks: [
        {
          type: 'p',
          text: 'Each ingredient has **one** cost that formulations use. Open the ingredient and go to the **Cost** tab. The top card shows the cost in use and where it comes from.',
        },
        { type: 'h', text: 'Option 1: type a price' },
        {
          type: 'steps',
          items: [
            'Under **Manual price**, type the price and choose **per kg** or **per lb**.',
            'Click `Save`.',
          ],
        },
        { type: 'h', text: 'Option 2: use a supplier’s price' },
        {
          type: 'steps',
          items: [
            'First link a supplier with a price (see [Linking suppliers and prices](#suppliers-tab)).',
            'Under **Use a supplier’s price**, click `Use this price` on the one you want. It changes to **✓ In use**.',
          ],
        },
        {
          type: 'list',
          items: [
            'A supplier price **in use** always wins over the manual price.',
            'Only prices per **kg, g, lb, oz or tonne (mt)** can be used, because benchtop needs a weight to convert. Prices per case, bag, drum, pail, each, L or gal can’t (the button is greyed out). Re-enter the price per kg or lb, or type a manual price.',
            'Only one supplier price can be in use. To stop using it, click **✓ In use**.',
          ],
        },
        {
          type: 'p',
          text: 'To see these costs on formulations, turn on COGS. See [Raw material cost (COGS)](/help/formulations#cogs).',
        },
      ],
    },
    {
      slug: 'stock',
      title: 'Stock and “on hand”',
      summary: 'Track how much you have, and what’s physically in the lab.',
      blocks: [
        {
          type: 'terms',
          items: [
            { term: 'On hand', text: 'A simple yes/no: “we have this in the lab”. On-hand ingredients get a green badge, appear first when you search in formulations, and are suggested as swaps (“On hand instead: …”).' },
            { term: 'Stock', text: 'An exact amount in grams. Optional: only ingredients with a stock number are tracked.' },
          ],
        },
        { type: 'h', text: 'Setting stock' },
        {
          type: 'steps',
          items: [
            'Open the ingredient and go to the **Inventory** tab.',
            'Click `Edit`, type the grams you have, and click `Save`. Leave it blank to turn tracking off.',
          ],
        },
        {
          type: 'p',
          text: 'When you use **Complete batch** on a formulation, the amounts used are subtracted from stock, and listed under **Depletion history**. Stock can go below zero; if it does, set it to the real amount. See [Recording a completed batch](/help/formulations#complete-batch).',
        },
      ],
    },
    {
      slug: 'verify',
      title: 'Verifying ingredients',
      summary: 'Mark data as checked so everyone can trust it.',
      blocks: [
        {
          type: 'p',
          text: '**Verified** means someone has checked this ingredient’s data against a reliable source. USDA imports start verified; everything else starts **Unverified** and shows a ⚠ in formulations.',
        },
        {
          type: 'steps',
          items: [
            'Open the ingredient and compare its nutrition, allergens and details with the spec sheet or COA.',
            'Click `Mark verified` at the top right. (Click `Mark unverified` to undo.)',
          ],
        },
      ],
    },
    {
      slug: 'duplicates',
      title: 'Duplicates: renaming or merging',
      summary: 'Fix two entries that describe the same ingredient.',
      blocks: [
        {
          type: 'p',
          text: 'Two ingredients count as duplicates when their **name, brand, supplier and item code** all match (ignoring capital letters and spaces). It’s fine to have “Pea Protein” from two different suppliers, because the supplier is different.',
        },
        {
          type: 'p',
          text: 'benchtop stops you creating a new duplicate with the message “An ingredient with the same name, brand, supplier and item code already exists”. Change one of the four, or use the existing ingredient. If duplicates already exist, the list shows a yellow banner and a **Duplicate — rename or merge** button on each one.',
        },
        { type: 'h', text: 'Fixing a duplicate' },
        {
          type: 'steps',
          items: [
            'Click **Duplicate — rename or merge** on the row (or `Rename` / `Merge…` on the ingredient’s page).',
            '**Rename** tab: change the name, brand, supplier or item code so it’s different, and click `Save changes`.',
            'Or the **Merge** tab: choose the entry to **keep**, read what will happen, and click `Merge … into …`.',
          ],
        },
        {
          type: 'warning',
          text: 'Merging **can’t be undone**. Formulations using the removed entries switch to the kept one, which can change their nutrition numbers, even on finalized versions. The kept entry’s values win; anything it’s missing (nutrients, documents, certifications, suppliers) is copied over, allergens are combined, and stock is added together.',
        },
      ],
    },
    {
      slug: 'delete',
      title: 'Deleting an ingredient',
      summary: 'Only ingredients not used in any formulation can be deleted.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Ingredients](/ingredients), click the **trash can** at the end of the row.',
            'Confirm. The ingredient and its nutrients, documents and supplier links are removed.',
          ],
        },
        {
          type: 'note',
          text: 'If you see “Failed to delete ingredient”, it’s probably used in a formulation. Check its **Formulations** tab, remove it from those recipes (or swap it out), then try again. If it’s a duplicate, merge it instead.',
        },
      ],
    },
    {
      slug: 'lab-intake',
      title: 'Lab Intake: logging a whole shelf at once',
      summary: 'Type or photograph container labels, let AI identify them, then add them all to the library.',
      blocks: [
        {
          type: 'p',
          text: 'Lab Intake is for getting lots of materials into benchtop quickly, for example when you set up a new lab or do a stock count. Go to [Ingredients](/ingredients) and click `Lab intake`. The list is shared with your team and stays until you upload it.',
        },
        { type: 'h', text: 'Step 1: Add items' },
        {
          type: 'list',
          items: [
            '**Type:** type each label, such as “Tapioca starch”, optionally with a **Qty** and unit, and press Enter. The box clears for the next one.',
            '**Paste a list:** click `Paste a list` and paste one item per line. A quantity at the end (“Inulin 2 kg”) is picked up automatically.',
            '**Snap label:** take photos of container labels (up to 10 at a time). AI reads each label’s name and amount. Dates and lot numbers are ignored.',
          ],
        },
        { type: 'h', text: 'Step 2: Identify & categorize' },
        {
          type: 'p',
          text: 'Click `Identify & categorize`. AI gives each item a clean standard name and a category, rates how sure it is (**high**, **medium** or **low**), and spots items **already in your library**.',
        },
        { type: 'h', text: 'Step 3: Review' },
        {
          type: 'p',
          text: 'Check each row, especially **low** confidence ones and any with a warning note. Click the pencil to fix the name, category or quantity, or to choose the right match under **Same material as a library ingredient**. Click the trash can to drop an item.',
        },
        { type: 'h', text: 'Step 4: Upload' },
        {
          type: 'p',
          text: 'Click `Upload to library` and confirm. Items matched to existing ingredients mark those as **on hand**; the rest become new ingredients, marked on hand.',
        },
        {
          type: 'warning',
          text: 'New ingredients from Lab Intake have **no nutrition data**. Add it afterwards by typing values in or reading them from a spec sheet (see [Entering nutrition values](#nutrients)). Weights you counted (g, kg, lb, oz) **replace** the ingredient’s stock, they don’t add to it. Volumes and counts (mL, L, gal, each) are saved in the notes instead.',
        },
      ],
    },
    {
      slug: 'equipment',
      title: 'Equipment',
      summary: 'The list of mixers, ovens and other equipment used in process steps.',
      blocks: [
        {
          type: 'p',
          text: 'Equipment doesn’t have its own page. You add it from any formulation’s process step: open the **Equipment** list, choose **+ Add new equipment…**, type the name, and click `Add`. It’s then available in every formulation on your account. Adding equipment needs edit access to the ingredient library.',
        },
        {
          type: 'note',
          text: 'Equipment can’t be renamed or deleted at the moment, so check the spelling before adding.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'What’s the quickest way to add a common ingredient?',
      a: 'Use `Search USDA` on [Ingredients](/ingredients). It brings in complete nutrition and marks the ingredient verified. See [Importing from USDA](/help/ingredients#add-usda).',
    },
    {
      q: 'My new ingredient has no nutrition. Why?',
      a: 'Ingredients added by hand or by Lab Intake start with no nutrients. Open the ingredient → **Nutrients** → `Edit nutrients`, or parse a spec sheet. See [Entering nutrition values](/help/ingredients#nutrients).',
    },
    {
      q: 'Saving nutrients says “Enter a source reference before saving.”',
      a: 'Every value needs a note saying where it came from. Type one in **Source reference** at the top, such as “Supplier COA Q2-2026”.',
    },
    {
      q: 'Are nutrition values per serving or per 100 g?',
      a: 'Always per 100 g of the ingredient. Convert per-serving values: value ÷ serving grams × 100.',
    },
    {
      q: 'My spec sheet gives vitamin D in IU. What do I enter?',
      a: 'benchtop doesn’t accept IU. Convert to the unit shown (for vitamin D, mcg: divide IU by 40).',
    },
    {
      q: 'Why did benchtop change the capitalization of my ingredient’s name?',
      a: 'Names are automatically capitalized word by word so the library is consistent. Abbreviations like MCT and DATEM stay in capitals, and words you capitalized yourself are kept.',
    },
    {
      q: 'It says an ingredient with the same name, brand, supplier and item code already exists.',
      a: 'There’s already an identical entry. Use that one, or make yours different by adding a brand, supplier or item code.',
    },
    {
      q: 'How do I change an ingredient’s category or mark it on hand?',
      a: 'On [Ingredients](/ingredients), click the pencil at the end of its row, change **Category** or tick **On hand in the lab**, and click `Save`.',
    },
    {
      q: 'Can I change Notes, Moisture % or Naturally derived after creating an ingredient?',
      a: 'Not at the moment; those are only set when the ingredient is created.',
    },
    {
      q: 'Why can’t I delete an ingredient?',
      a: 'It’s used in at least one formulation. Remove it from those formulations first (see its **Formulations** tab), or merge it if it’s a duplicate.',
    },
    {
      q: 'What does the ⚠ “Unverified” mean?',
      a: 'Nobody has confirmed this ingredient’s data yet. Check it against the spec sheet, then click `Mark verified`.',
    },
    {
      q: 'What happens when I merge duplicates?',
      a: 'You pick which entry to keep. Formulations switch to it, missing data is copied over, allergens are combined, stock is added. It can’t be undone and can change formulation numbers.',
    },
    {
      q: 'Why is “Use this price” greyed out on the Cost tab?',
      a: 'That supplier price is per case, bag, drum, pail, each, L or gal, so benchtop can’t turn it into a price per kg. Enter the price per kg or lb instead.',
    },
    {
      q: 'Which cost does a formulation use if I have both a manual price and a supplier price?',
      a: 'The supplier price marked **✓ In use** wins. If none is in use (or it can’t be converted), the manual price is used.',
    },
    {
      q: 'What’s the difference between the “Supplier” text box and linked suppliers?',
      a: 'The **Supplier** text is part of the ingredient’s identity (used to tell duplicates apart). Linked suppliers on the **Suppliers** tab are full supplier records with pack sizes and prices. Both make the ingredient show up on that supplier’s page.',
    },
    {
      q: 'What’s the difference between “On hand” and “Stock”?',
      a: 'On hand is a yes/no “we have it in the lab”. Stock is an exact amount in grams. You can use either or both.',
    },
    {
      q: 'Why is my stock negative?',
      a: 'More was used in completed batches than the stock you’d recorded. Go to the **Inventory** tab and enter the real amount.',
    },
    {
      q: 'Does Lab Intake add to my stock or replace it?',
      a: 'It replaces it: weights you counted become the new stock, because a shelf count is the real amount.',
    },
    {
      q: 'Lab Intake matched an item to the wrong ingredient.',
      a: 'Click the pencil on the item and choose the right ingredient under **Same material as a library ingredient**, or **No, add it as a new ingredient**. Then `Save`.',
    },
    {
      q: 'Why can’t I add or edit ingredients?',
      a: 'Your access to the ingredient library is view-only. Ask an owner or admin to change **Ingredient library & suppliers** to `Can edit` for you. Until then, changes you try to make won’t be saved.',
    },
    {
      q: 'What files can I upload as documents?',
      a: 'PDF, Word, Excel, CSV, PNG, JPG and WebP, up to 20 MB each. Only PDFs and images can be read by AI.',
    },
    {
      q: 'The supplier web page import didn’t find anything.',
      a: 'Some websites block it or load their content in a way it can’t read. Download the spec sheet instead, upload it on the **Documents** tab, and use `Parse with AI`.',
    },
    {
      q: 'I can’t find an ingredient I added a long time ago.',
      a: 'The list shows the 500 most recently added ingredients. Search for it by name in **Filter ingredients…**, and check the category, **On hand only** and duplicates filters are off.',
    },
    {
      q: 'If I edit an ingredient, do my formulations change?',
      a: 'Yes. Formulations always use the current library data, so nutrition, allergens and costs update everywhere. Saved Nutrition Facts panels stay frozen as they were.',
    },
  ],
}
