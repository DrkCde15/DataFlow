import type { NodeDefinition } from '../types';

export const processingNodes: NodeDefinition[] = [
  {
    type: 'python',
    label: 'Python',
    category: 'processing',
    description: 'Custom Python processing',
    icon: 'python',
    configSchema: [
      {
        key: 'code',
        label: 'Python code',
        type: 'textarea',
        placeholder: 'df = df[df["active"]]',
      },
    ],
  },
  {
    type: 'sql',
    label: 'SQL',
    category: 'processing',
    description: 'Transform data with SQL',
    icon: 'sql',
    configSchema: [
      {
        key: 'query',
        label: 'Query',
        type: 'textarea',
        placeholder: 'SELECT * FROM input WHERE amount > 0',
        required: true,
      },
    ],
  },
  {
    type: 'pyspark',
    label: 'PySpark',
    category: 'processing',
    description: 'Distributed processing with Spark',
    icon: 'pyspark',
    configSchema: [
      {
        key: 'code',
        label: 'PySpark code',
        type: 'textarea',
        placeholder: 'df = df.filter(df.amount > 100)',
      },
      {
        key: 'master',
        label: 'Spark master',
        type: 'text',
        placeholder: 'local[*]',
        defaultValue: 'local[*]',
      },
      {
        key: 'timeout_seconds',
        label: 'Timeout (seconds)',
        type: 'number',
        defaultValue: 300,
      },
    ],
  },
  {
    type: 'filter',
    label: 'Filter',
    category: 'processing',
    description: 'Keep rows matching rules',
    icon: 'filter',
    configSchema: [
      {
        key: 'condition',
        label: 'Condition',
        type: 'text',
        placeholder: 'amount > 100',
        required: true,
      },
    ],
  },
  {
    type: 'join',
    label: 'Join',
    category: 'processing',
    description: 'Combine datasets by keys',
    icon: 'join',
    configSchema: [
      {
        key: 'left_key',
        label: 'Left key',
        type: 'text',
        placeholder: 'customer_id',
      },
      {
        key: 'right_key',
        label: 'Right key',
        type: 'text',
        placeholder: 'id',
      },
      {
        key: 'join_type',
        label: 'Join type',
        type: 'select',
        defaultValue: 'inner',
        options: [
          { value: 'inner', label: 'Inner' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'full', label: 'Full outer' },
        ],
      },
    ],
  },
  {
    type: 'aggregate',
    label: 'Aggregate',
    category: 'processing',
    description: 'Group and summarize data',
    icon: 'aggregate',
    configSchema: [
      {
        key: 'group_by',
        label: 'Group by',
        type: 'text',
        placeholder: 'category',
      },
      {
        key: 'aggregations',
        label: 'Aggregations',
        type: 'text',
        placeholder: 'sum(total), avg(price)',
        required: true,
      },
    ],
  },
];
