import type { NodeDefinition } from '../types';

export const qualityNodes: NodeDefinition[] = [
  {
    type: 'schema-validation',
    label: 'Schema Validation',
    category: 'quality',
    description: 'Validate columns and types',
    icon: 'schema-validation',
    configSchema: [
      {
        key: 'schema',
        label: 'Expected schema (JSON)',
        type: 'textarea',
        placeholder: '{"id": "integer", "email": "string"}',
      },
    ],
  },
  {
    type: 'null-check',
    label: 'Null Check',
    category: 'quality',
    description: 'Detect unexpected null values',
    icon: 'null-check',
    configSchema: [
      {
        key: 'columns',
        label: 'Columns',
        type: 'text',
        placeholder: 'id, email',
        required: true,
      },
    ],
  },
  {
    type: 'duplicate-check',
    label: 'Duplicate Check',
    category: 'quality',
    description: 'Detect duplicate records',
    icon: 'duplicate-check',
    configSchema: [
      {
        key: 'keys',
        label: 'Key columns',
        type: 'text',
        placeholder: 'id',
        required: true,
      },
    ],
  },
  {
    type: 'data-freshness',
    label: 'Data Freshness',
    category: 'quality',
    description: 'Verify data is up to date',
    icon: 'freshness',
    configSchema: [
      {
        key: 'column',
        label: 'Timestamp column',
        type: 'text',
        placeholder: 'updated_at',
        required: true,
      },
      {
        key: 'max_age_hours',
        label: 'Max age (hours)',
        type: 'number',
        defaultValue: 24,
      },
    ],
  },
];
