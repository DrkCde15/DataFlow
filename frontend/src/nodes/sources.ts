import type { NodeDefinition } from '../types';

export const sourceNodes: NodeDefinition[] = [
  {
    type: 'rest-api',
    label: 'REST API',
    category: 'sources',
    description: 'API data source',
    icon: 'rest-api',
    configSchema: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://api.example.com/v1/data',
        required: true,
      },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        defaultValue: 'GET',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
        ],
      },
      {
        key: 'headers',
        label: 'Headers',
        type: 'textarea',
        placeholder: 'Authorization: Bearer token',
      },
    ],
  },
  {
    type: 'file',
    label: 'File',
    category: 'sources',
    description: 'Import local data files',
    icon: 'file',
    configSchema: [
      {
        key: 'file',
        label: 'File',
        type: 'file',
        required: true,
        accept: '.csv,.json,.parquet,.txt,.xlsx',
      },
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        defaultValue: 'auto',
        options: [
          { value: 'auto', label: 'Auto detect' },
          { value: 'csv', label: 'CSV' },
          { value: 'json', label: 'JSON' },
          { value: 'parquet', label: 'Parquet' },
        ],
      },
      {
        key: 'delimiter',
        label: 'Delimiter',
        type: 'text',
        defaultValue: ',',
        placeholder: ',',
      },
    ],
  },
  {
    type: 'json',
    label: 'JSON',
    category: 'sources',
    description: 'JSON endpoint source',
    icon: 'json',
    configSchema: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://api.example.com/data.json',
        required: true,
      },
    ],
  },
  {
    type: 'postgres-source',
    label: 'PostgreSQL',
    category: 'sources',
    description: 'PostgreSQL table source',
    icon: 'database',
    configSchema: [
      {
        key: 'connection_id',
        label: 'Connection',
        type: 'connection',
        connectionType: 'postgres',
        required: true,
      },
      {
        key: 'query',
        label: 'Query',
        type: 'textarea',
        placeholder: 'SELECT * FROM table',
        required: true,
      },
    ],
  },
  {
    type: 'mysql-source',
    label: 'MySQL',
    category: 'sources',
    description: 'MySQL table source',
    icon: 'server',
    configSchema: [
      {
        key: 'connection_id',
        label: 'Connection',
        type: 'connection',
        connectionType: 'mysql',
        required: true,
      },
      {
        key: 'query',
        label: 'Query',
        type: 'textarea',
        placeholder: 'SELECT * FROM table',
        required: true,
      },
    ],
  },
  {
    type: 'web-scraping',
    label: 'Web Scraping',
    category: 'sources',
    description: 'Extract data from web pages',
    icon: 'web-scraping',
    configSchema: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://example.com/page',
        required: true,
      },
      {
        key: 'selector',
        label: 'CSS selector',
        type: 'text',
        placeholder: 'table.rows tr',
      },
    ],
  },
];
