import { createContext, useContext } from 'react';
import type { NodeConfiguration } from '../../types';

export interface NodeActions {
  updateNode: (nodeId: string, patch: Partial<NodeConfiguration>) => void;
  deleteNode: (nodeId: string) => void;
}

export const NodeActionsContext = createContext<NodeActions | null>(null);

export function useNodeActions(): NodeActions {
  const actions = useContext(NodeActionsContext);
  if (!actions) {
    throw new Error('useNodeActions must be used within NodeActionsContext');
  }
  return actions;
}
