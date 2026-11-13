import type { Tour } from './types'

export const ingredientDetailTour: Tour = {
  id: 'ingredient-detail-v1',
  paths: ['/ingredients/:id'],
  steps: [
    {
      target: 'ingredient-header',
      title: 'One ingredient, in full',
      body: 'Name, label name, brand and badges sit up top. Hover over the name or label line and click the pencil to change it.',
    },
    {
      target: 'ingredient-actions',
      title: 'Details and verification',
      body: 'Edit details sets the category, on hand, stock and moisture. Mark it verified once you’ve checked the data against a spec sheet.',
    },
    {
      target: 'ingredient-tabs',
      title: 'Everything in tabs',
      body: 'Nutrients, allergens, certifications and sub-ingredients feed your labels, so keep them accurate. Documents, cost and inventory live here too.',
    },
    {
      target: 'ingredient-edit-nutrients',
      title: 'Enter nutrition',
      body: 'Type values per 100 g, or read them from an uploaded spec sheet with AI. Changes apply everywhere this ingredient is used.',
    },
    {
      target: 'ingredient-tab-suppliers',
      title: 'Suppliers and prices',
      body: 'Link who sells it, the pack size and the price. That cost flows into your formulations’ COGS.',
    },
  ],
}
