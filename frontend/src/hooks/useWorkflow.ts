import { useCallback, useState } from 'react';
import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition,
} from '@xyflow/react';
import {
  ApiError,
  createConnection as createConnectionApi,
  createWorkflow,
  deleteConnection as deleteConnectionApi,
  deleteWorkflow as deleteWorkflowApi,
  fetchWorkflow,
  isServerUnreachable,
  listConnections,
  listWorkflows,
  renameWorkflow as renameWorkflowApi,
  updateConnection as updateConnectionApi,
  updateWorkflow,
} from '../api/client';
import { DEMO_WORKFLOW_NAME, demoEdges, demoNodes } from '../data/demoWorkflow';
import { buildDefaultConfig, getNodeDefinition } from '../nodes/registry';
import type {
  ApiStatus,
  ConnectionInput,
  ConnectionPatch,
  ConnectionSummary,
  NodeConfiguration,
  SaveState,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRecord,
  WorkflowSummary,
} from '../types';

interface NodeChangeLike {
  type: string;
}

function changesAffectContent(changes: NodeChangeLike[]): boolean {
  return changes.some((change) => change.type !== 'select');
}

function sanitizeNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => ({ ...node, selected: false }));
}

export interface UseWorkflowResult {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  workflowId: string | null;
  workflowName: string;
  workflows: WorkflowSummary[];
  saveState: SaveState;
  apiStatus: ApiStatus;
  isDirty: boolean;
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange<WorkflowEdge>;
  onConnect: (connection: Connection) => void;
  addNode: (nodeType: string, position: XYPosition) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeConfiguration: (
    nodeId: string,
    patch: Partial<NodeConfiguration>,
  ) => void;
  loadInitialWorkflow: () => Promise<void>;
  saveWorkflow: () => Promise<void>;
  openWorkflow: (id: string) => Promise<void>;
  createNewWorkflow: () => void;
  renameWorkflow: (id: string, name: string) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  connections: ConnectionSummary[];
  refreshConnections: () => Promise<void>;
  createConnection: (input: ConnectionInput) => Promise<ConnectionSummary>;
  updateConnection: (
    id: string,
    patch: ConnectionPatch,
  ) => Promise<ConnectionSummary>;
  deleteConnection: (id: string) => Promise<void>;
}

export function useWorkflow(): UseWorkflowResult {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(
    demoNodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(
    demoEdges,
  );
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(DEMO_WORKFLOW_NAME);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [apiStatus, setApiStatus] = useState<ApiStatus>('unknown');
  const [isDirty, setIsDirty] = useState(false);

  const refreshWorkflows = useCallback(async () => {
    try {
      const list = await listWorkflows();
      setWorkflows(list);
      setApiStatus('online');
      return list;
    } catch (error) {
      if (isServerUnreachable(error)) {
        setApiStatus('offline');
      }
      return [];
    }
  }, []);

  const applyRecord = useCallback(
    (record: WorkflowRecord) => {
      setNodes(sanitizeNodes(record.nodes));
      setEdges(record.edges);
      setWorkflowId(record.id);
      setWorkflowName(record.name);
      setIsDirty(false);
      setSaveState('saved');
    },
    [setNodes, setEdges],
  );

  const resetToLocalWorkflow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setWorkflowId(null);
    setWorkflowName('Untitled workflow');
    setSaveState('idle');
    setIsDirty(false);
  }, [setNodes, setEdges]);

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) {
      return true;
    }
    return window.confirm('You have unsaved changes. Discard them?');
  }, [isDirty]);

  const handleNodesChange: OnNodesChange<WorkflowNode> = useCallback(
    (changes) => {
      if (changesAffectContent(changes)) {
        setIsDirty(true);
      }
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  const handleEdgesChange: OnEdgesChange<WorkflowEdge> = useCallback(
    (changes) => {
      if (changesAffectContent(changes)) {
        setIsDirty(true);
      }
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setIsDirty(true);
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `edge-${crypto.randomUUID()}`,
            type: 'smoothstep',
          },
          current,
        ),
      );
    },
    [setEdges],
  );

  const addNode = useCallback(
    (nodeType: string, position: XYPosition) => {
      const definition = getNodeDefinition(nodeType);
      if (!definition) {
        return;
      }

      const node: WorkflowNode = {
        id: `${definition.type}-${crypto.randomUUID()}`,
        type: definition.type,
        position,
        data: {
          nodeType: definition.type,
          name: definition.label,
          description: definition.description,
          status: 'ready',
          config: buildDefaultConfig(definition),
        },
      };

      setIsDirty(true);
      setNodes((current) => [...current, node]);
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setIsDirty(true);
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
    },
    [setNodes, setEdges],
  );

  const updateNodeConfiguration = useCallback(
    (nodeId: string, patch: Partial<NodeConfiguration>) => {
      setIsDirty(true);
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const loadInitialWorkflow = useCallback(async () => {
    try {
      const list = await listWorkflows();
      setWorkflows(list);
      setApiStatus('online');

      if (list.length === 0) {
        return;
      }

      const record = await fetchWorkflow(list[0].id);
      applyRecord(record);
    } catch {
      setApiStatus('offline');
    }
  }, [applyRecord]);

  const saveWorkflow = useCallback(async () => {
    setSaveState('saving');

    const payload = {
      name: workflowName,
      nodes: sanitizeNodes(nodes),
      edges,
    };

    try {
      let saved;

      if (workflowId) {
        try {
          saved = await updateWorkflow(workflowId, payload);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            saved = await createWorkflow(payload);
          } else {
            throw error;
          }
        }
      } else {
        saved = await createWorkflow(payload);
      }

      setWorkflowId(saved.id);
      setWorkflowName(saved.name);
      setApiStatus('online');
      setIsDirty(false);
      setSaveState('saved');
      await refreshWorkflows();
    } catch (error) {
      if (isServerUnreachable(error)) {
        setApiStatus('offline');
      }
      setSaveState('error');
    }
  }, [nodes, edges, workflowId, workflowName, refreshWorkflows]);

  const openWorkflow = useCallback(
    async (id: string) => {
      if (!confirmDiscardChanges()) {
        return;
      }

      try {
        const record = await fetchWorkflow(id);
        applyRecord(record);
        setApiStatus('online');
      } catch (error) {
        if (isServerUnreachable(error)) {
          setApiStatus('offline');
        }
      }
    },
    [applyRecord, confirmDiscardChanges],
  );

  const createNewWorkflow = useCallback(() => {
    if (!confirmDiscardChanges()) {
      return;
    }
    resetToLocalWorkflow();
  }, [confirmDiscardChanges, resetToLocalWorkflow]);

  const renameWorkflow = useCallback(
    async (id: string, name: string) => {
      try {
        const renamed = await renameWorkflowApi(id, name);
        if (id === workflowId) {
          setWorkflowName(renamed.name);
        }
        setApiStatus('online');
        await refreshWorkflows();
      } catch (error) {
        if (isServerUnreachable(error)) {
          setApiStatus('offline');
        }
      }
    },
    [workflowId, refreshWorkflows],
  );

  const deleteWorkflow = useCallback(
    async (id: string) => {
      const isCurrent = id === workflowId;
      if (isCurrent && !confirmDiscardChanges()) {
        return;
      }

      try {
        await deleteWorkflowApi(id);
        setApiStatus('online');
        await refreshWorkflows();
        if (isCurrent) {
          resetToLocalWorkflow();
        }
      } catch (error) {
        if (isServerUnreachable(error)) {
          setApiStatus('offline');
        }
      }
    },
    [workflowId, confirmDiscardChanges, refreshWorkflows, resetToLocalWorkflow],
  );

  const refreshConnections = useCallback(async () => {
    try {
      const list = await listConnections();
      setConnections(list);
      setApiStatus('online');
    } catch (error) {
      if (isServerUnreachable(error)) {
        setApiStatus('offline');
      }
    }
  }, []);

  const createConnection = useCallback(
    async (input: ConnectionInput) => {
      try {
        const created = await createConnectionApi(input);
        setApiStatus('online');
        await refreshConnections();
        return created;
      } catch (error) {
        if (isServerUnreachable(error)) {
          setApiStatus('offline');
        }
        throw error;
      }
    },
    [refreshConnections],
  );

  const updateConnection = useCallback(
    async (id: string, patch: ConnectionPatch) => {
      try {
        const updated = await updateConnectionApi(id, patch);
        setApiStatus('online');
        await refreshConnections();
        return updated;
      } catch (error) {
        if (isServerUnreachable(error)) {
          setApiStatus('offline');
        }
        throw error;
      }
    },
    [refreshConnections],
  );

  const deleteConnection = useCallback(
    async (id: string) => {
      try {
        await deleteConnectionApi(id);
        setApiStatus('online');
        await refreshConnections();
      } catch (error) {
        if (isServerUnreachable(error)) {
          setApiStatus('offline');
        }
        throw error;
      }
    },
    [refreshConnections],
  );

  const selectedNode = nodes.find((node) => node.selected) ?? null;

  return {
    nodes,
    edges,
    selectedNode,
    workflowId,
    workflowName,
    workflows,
    saveState,
    apiStatus,
    isDirty,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    updateNodeConfiguration,
    loadInitialWorkflow,
    saveWorkflow,
    openWorkflow,
    createNewWorkflow,
    renameWorkflow,
    deleteWorkflow,
    connections,
    refreshConnections,
    createConnection,
    updateConnection,
    deleteConnection,
  };
}
