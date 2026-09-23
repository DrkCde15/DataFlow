import type {
  NodeCategory,
  NodeCategoryMeta,
  NodeDefinition,
} from '../types';
import { orchestrationNodes } from './orchestration';
import { processingNodes } from './processing';
import { qualityNodes } from './quality';
import { sourceNodes } from './sources';
import { storageNodes } from './storage';

export const NODE_CATEGORIES: NodeCategoryMeta[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'processing', label: 'Processing' },
  { id: 'quality', label: 'Data Quality' },
  { id: 'storage', label: 'Storage' },
  { id: 'orchestration', label: 'Orchestration' },
];

export const ALL_NODE_DEFINITIONS: NodeDefinition[] = [
  ...sourceNodes,
  ...processingNodes,
  ...qualityNodes,
  ...storageNodes,
  ...orchestrationNodes,
];

const definitionIndex = new Map<string, NodeDefinition>(
  ALL_NODE_DEFINITIONS.map((definition) => [definition.type, definition]),
);

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return definitionIndex.get(type);
}

export function getNodeDefinitionsByCategory(
  category: NodeCategory,
): NodeDefinition[] {
  return ALL_NODE_DEFINITIONS.filter(
    (definition) => definition.category === category,
  );
}

export function getCategoryLabel(category: NodeCategory): string {
  return (
    NODE_CATEGORIES.find((entry) => entry.id === category)?.label ?? category
  );
}
