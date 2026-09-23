import type { NodeDefinition } from '../types';

export const storageNodes: NodeDefinition[] = [
  {
    type: 'postgres-storage',
    label: 'PostgreSQL',
    category: 'storage',
    description: 'Persist data in PostgreSQL',
    icon: 'database',
    configSchema: [
      {
        key: 'connection_string',
        label: 'Connection',
        type: 'text',
        placeholder: 'postgresql://user:pass@host:5432/db',
        required: true,
      },
      {
        key: 'table',
        label: 'Table',
        type: 'text',
        placeholder: 'public.events',
        required: true,
      },
    ],
  },
  {
    type: 'parquet',
    label: 'Parquet',
    category: 'storage',
    description: 'Write columnar Parquet files',
    icon: 'parquet',
    configSchema: [
      {
        key: 'path',
        label: 'Path',
        type: 'text',
        placeholder: 'data/output.parquet',
        required: true,
      },
    ],
  },
  {
    type: 'delta-lake',
    label: 'Delta Lake',
    category: 'storage',
    description: 'ACID storage on the lakehouse',
    icon: 'delta-lake',
    configSchema: [
      {
        key: 'path',
        label: 'Path',
        type: 'text',
        placeholder: 'lake/bronze/table',
        required: true,
      },
      {
        key: 'table',
        label: 'Table name',
        type: 'text',
        placeholder: 'orders',
      },
    ],
  },
  {
    type: 'data-warehouse',
    label: 'Data Warehouse',
    category: 'storage',
    description: 'Load a dimensional warehouse',
    icon: 'data-warehouse',
    configSchema: [
      {
        key: 'connection_string',
        label: 'Connection',
        type: 'text',
        placeholder: 'snowflake://user:pass@account',
        required: true,
      },
      {
        key: 'table',
        label: 'Table',
        type: 'text',
        placeholder: 'fact_orders',
        required: true,
      },
    ],
  },
];
