import type { WorkflowEdge, WorkflowNode } from '../types';

export const DEMO_WORKFLOW_NAME = 'medallion-pipeline-demo';

export const demoNodes: WorkflowNode[] = [
  {
    id: 'rest-api-1',
    type: 'rest-api',
    position: { x: 0, y: 100 },
    data: {
      nodeType: 'rest-api',
      name: 'REST API',
      description: 'API data source',
      status: 'ready',
    },
  },
  {
    id: 'bronze-1',
    type: 'delta-lake',
    position: { x: 290, y: 100 },
    data: {
      nodeType: 'delta-lake',
      name: 'Bronze',
      description: 'Raw data storage layer',
      status: 'ready',
    },
  },
  {
    id: 'silver-1',
    type: 'delta-lake',
    position: { x: 580, y: 100 },
    data: {
      nodeType: 'delta-lake',
      name: 'Silver',
      description: 'Cleansed and validated layer',
      status: 'ready',
    },
  },
  {
    id: 'gold-1',
    type: 'delta-lake',
    position: { x: 870, y: 100 },
    data: {
      nodeType: 'delta-lake',
      name: 'Gold',
      description: 'Business-ready aggregated layer',
      status: 'ready',
    },
  },
];

export const demoEdges: WorkflowEdge[] = [
  {
    id: 'edge-rest-bronze',
    source: 'rest-api-1',
    target: 'bronze-1',
  },
  {
    id: 'edge-bronze-silver',
    source: 'bronze-1',
    target: 'silver-1',
  },
  {
    id: 'edge-silver-gold',
    source: 'silver-1',
    target: 'gold-1',
  },
];
