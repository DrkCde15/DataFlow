import type { NodeDefinition } from '../types';

export const sourceNodes: NodeDefinition[] = [
  {
    type: 'rest-api',
    label: 'REST API',
    category: 'sources',
    description: 'API data source',
    icon: 'rest-api',
  },
  {
    type: 'csv',
    label: 'CSV',
    category: 'sources',
    description: 'CSV file ingestion',
    icon: 'csv',
  },
  {
    type: 'json',
    label: 'JSON',
    category: 'sources',
    description: 'JSON file or stream',
    icon: 'json',
  },
  {
    type: 'postgres-source',
    label: 'PostgreSQL',
    category: 'sources',
    description: 'PostgreSQL table source',
    icon: 'database',
  },
  {
    type: 'mysql-source',
    label: 'MySQL',
    category: 'sources',
    description: 'MySQL table source',
    icon: 'server',
  },
  {
    type: 'web-scraping',
    label: 'Web Scraping',
    category: 'sources',
    description: 'Extract data from web pages',
    icon: 'web-scraping',
  },
];
