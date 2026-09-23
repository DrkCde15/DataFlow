import type { NodeDefinition } from '../types';

export const processingNodes: NodeDefinition[] = [
  {
    type: 'python',
    label: 'Python',
    category: 'processing',
    description: 'Custom Python processing',
    icon: 'python',
  },
  {
    type: 'sql',
    label: 'SQL',
    category: 'processing',
    description: 'Transform data with SQL',
    icon: 'sql',
  },
  {
    type: 'pyspark',
    label: 'PySpark',
    category: 'processing',
    description: 'Distributed processing with Spark',
    icon: 'pyspark',
  },
  {
    type: 'filter',
    label: 'Filter',
    category: 'processing',
    description: 'Keep rows matching rules',
    icon: 'filter',
  },
  {
    type: 'join',
    label: 'Join',
    category: 'processing',
    description: 'Combine datasets by keys',
    icon: 'join',
  },
  {
    type: 'aggregate',
    label: 'Aggregate',
    category: 'processing',
    description: 'Group and summarize data',
    icon: 'aggregate',
  },
];
