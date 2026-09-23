import type { NodeDefinition } from '../types';

export const qualityNodes: NodeDefinition[] = [
  {
    type: 'schema-validation',
    label: 'Schema Validation',
    category: 'quality',
    description: 'Validate columns and types',
    icon: 'schema-validation',
  },
  {
    type: 'null-check',
    label: 'Null Check',
    category: 'quality',
    description: 'Detect unexpected null values',
    icon: 'null-check',
  },
  {
    type: 'duplicate-check',
    label: 'Duplicate Check',
    category: 'quality',
    description: 'Detect duplicate records',
    icon: 'duplicate-check',
  },
  {
    type: 'data-freshness',
    label: 'Data Freshness',
    category: 'quality',
    description: 'Verify data is up to date',
    icon: 'freshness',
  },
];
