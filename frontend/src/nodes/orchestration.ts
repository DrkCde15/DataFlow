import type { NodeDefinition } from '../types';

export const orchestrationNodes: NodeDefinition[] = [
  {
    type: 'schedule',
    label: 'Schedule',
    category: 'orchestration',
    description: 'Run on a time schedule',
    icon: 'schedule',
    configSchema: [
      {
        key: 'cron',
        label: 'Cron expression',
        type: 'text',
        placeholder: '0 6 * * *',
        required: true,
      },
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'text',
        placeholder: 'America/Sao_Paulo',
        defaultValue: 'UTC',
      },
    ],
  },
  {
    type: 'trigger',
    label: 'Trigger',
    category: 'orchestration',
    description: 'Start on an event',
    icon: 'trigger',
    configSchema: [
      {
        key: 'event',
        label: 'Event',
        type: 'text',
        placeholder: 'file.created',
        required: true,
      },
    ],
  },
  {
    type: 'condition',
    label: 'Condition',
    category: 'orchestration',
    description: 'Branch on a rule',
    icon: 'condition',
    configSchema: [
      {
        key: 'expression',
        label: 'Expression',
        type: 'text',
        placeholder: 'row_count > 0',
        required: true,
      },
    ],
  },
  {
    type: 'workflow-call',
    label: 'Workflow',
    category: 'orchestration',
    description: 'Run another workflow',
    icon: 'workflow',
    configSchema: [
      {
        key: 'workflow_id',
        label: 'Workflow',
        type: 'workflow',
        required: true,
      },
    ],
  },
];
