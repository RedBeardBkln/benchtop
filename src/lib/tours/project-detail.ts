import type { Tour } from './types'

export const projectDetailTour: Tour = {
  id: 'project-detail-v1',
  paths: ['/projects/:id'],
  steps: [
    {
      target: 'project-detail-header',
      title: 'About this project',
      body: 'Here’s the project’s name, client and status. Add an objective so everyone knows what this product is aiming for.',
    },
    {
      target: 'project-detail-new',
      title: 'Start a formulation',
      body: 'Build a recipe from ingredients, or reverse engineer one to match an existing product label.',
    },
    {
      target: 'project-detail-import',
      title: 'Import from a spreadsheet',
      body: 'Have the recipe in Excel or CSV? Import it straight into this project. You check it before anything is created.',
    },
    {
      target: 'project-detail-formulations',
      title: 'Your formulations',
      body: 'Each formulation shows its latest version and status. Click one to open it and keep working.',
    },
    {
      target: 'project-detail-targets',
      title: 'Set nutrition targets',
      body: 'Targets like “at least 20 g protein per serving” are checked against every formulation here, so you can see at a glance what passes.',
    },
  ],
}
