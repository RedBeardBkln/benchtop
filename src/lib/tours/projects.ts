import type { Tour } from './types'

export const projectsTour: Tour = {
  id: 'projects-v1',
  paths: ['/projects'],
  steps: [
    {
      title: 'Welcome to Projects',
      body: 'A project is a folder for one product idea. It holds that product’s formulations and nutrition targets. This short tour shows the essentials.',
    },
    {
      target: 'projects-new',
      title: 'Start a project',
      body: 'Create a project for each new product. You can link it to a client and set nutrition targets later.',
    },
    {
      target: 'projects-import',
      title: 'Bring in a spreadsheet',
      body: 'Already have a recipe in Excel or CSV? Import it as a formulation. You choose its project and review it before anything is created.',
    },
    {
      target: 'projects-list',
      title: 'Your projects',
      body: 'Every project you can see is listed here with its client, formulation count and status. Click a row to open it.',
    },
    {
      target: 'nav',
      title: 'Everything else',
      body: 'Ingredients, suppliers, clients and Sous Chef live in the menu. Each page has its own short tour the first time you open it.',
    },
    {
      target: 'tour-replay',
      title: 'See this again',
      body: 'Use “Page tour” at the foot of any page to replay its tour. You can turn automatic tours off in Settings › Preferences.',
    },
  ],
}
