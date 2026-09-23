import type { NodeTypes } from '@xyflow/react';
import { ALL_NODE_DEFINITIONS } from '../../nodes/registry';
import { DataNode } from './DataNode';

export const workflowNodeTypes: NodeTypes = Object.fromEntries(
  ALL_NODE_DEFINITIONS.map((definition) => [definition.type, DataNode]),
) as NodeTypes;
