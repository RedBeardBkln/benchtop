import type { Tour } from './types'

export const formulationTour: Tour = {
  id: 'formulation-v1',
  paths: ['/formulations/:id'],
  steps: [
    {
      title: 'Your formulation',
      body: 'This is where you build the recipe. Nutrition, yield and target checks update as you type, so you see the effect of every change right away.',
    },
    {
      target: 'formulation-add-ingredient',
      title: 'Add ingredients',
      body: 'Search your ingredient library, or add a new one by hand or from USDA without leaving the page.',
    },
    {
      target: 'formulation-grid',
      title: 'Weights, % and nutrients',
      body: 'Type a weight or a usage % and the rest updates. Lock an amount to keep it fixed while you adjust the others.',
    },
    {
      target: 'formulation-settings',
      title: 'Batch, serving and yield',
      body: 'Scale the whole recipe by changing the batch size, and set a serving size for per-serving nutrition.',
    },
    {
      target: 'formulation-process-steps',
      title: 'Write the method',
      body: 'Add process steps with losses, temperatures and times. Losses feed into the yield and the nutrition per 100 g finished.',
    },
    {
      target: 'formulation-actions',
      title: 'Save, label and more',
      body: 'Grid changes aren’t saved on their own: click Save when it appears. Here you’ll also find the Nutrition Facts panel, Solve and Options for versions and printing.',
    },
  ],
}
