import type { NodeDefinition } from '../types';

export const storageNodes: NodeDefinition[] = [
  {
    type: 'postgres-storage',
    label: 'PostgreSQL',
    category: 'storage',
    description: 'Persist data in PostgreSQL',
    icon: 'database',
  },
  {
    type: 'parquet',
    label: 'Parquet',
    category: 'storage',
    description: 'Write columnar Parquet files',
    icon: 'parquet',
  },
  {
    type: 'delta-lake',
    label: 'Delta Lake',
    category: 'storage',
    description: 'ACID storage on the lakehouse',
    icon: 'delta-lake',
  },
  {
    type: 'data-warehouse',
    label: 'Data Warehouse',
    category: 'storage',
    description: 'Load a dimensional warehouse',
    icon: 'data-warehouse',
  },
];
