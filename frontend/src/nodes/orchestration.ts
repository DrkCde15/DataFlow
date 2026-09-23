import type { NodeDefinition } from '../types';

export const orchestrationNodes: NodeDefinition[] = [
  {
    type: 'schedule',
    label: 'Schedule',
    category: 'orchestration',
    description: 'Run on a time schedule',
    icon: 'schedule',
  },
  {
    type: 'trigger',
    label: 'Trigger',
    category: 'orchestration',
    description: 'Start on an event',
    icon: 'trigger',
  },
  {
    type: 'condition',
    label: 'Condition',
    category: 'orchestration',
    description: 'Branch on a rule',
    icon: 'condition',
  },
];
