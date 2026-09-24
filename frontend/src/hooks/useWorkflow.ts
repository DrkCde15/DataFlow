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
  runWorkflow as runWorkflowApi,
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
  RunNodeStatus,
  RunState,
  SaveState,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRecord,
  WorkflowRun,
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
  runStatus: Record<string, RunNodeStatus>;
  lastRun: WorkflowRun | null;
  runState: RunState;
  executeWorkflow: () => Promise<void>;
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
  const [runStatus, setRunStatus] = useState<Record<string, RunNodeStatus>>({});
  const [lastRun, setLastRun] = useState<WorkflowRun | null>(null);
  const [runState, setRunState] = useState<RunState>('idle');

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setRunStatus({});
    setLastRun(null);
    setRunState('idle');
  }, []);

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
      setRunStatus({});
      setLastRun(null);
      setRunState('idle');
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
    setRunStatus({});
    setLastRun(null);
    setRunState('idle');
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
        markDirty();
      }
      onNodesChange(changes);
    },
    [onNodesChange, markDirty],
  );

  const handleEdgesChange: OnEdgesChange<WorkflowEdge> = useCallback(
    (changes) => {
      if (changesAffectContent(changes)) {
        markDirty();
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, markDirty],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      markDirty();
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
    [setEdges, markDirty],
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

      markDirty();
      setNodes((current) => [...current, node]);
    },
    [setNodes, markDirty],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      markDirty();
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
    },
    [setNodes, setEdges, markDirty],
  );

  const updateNodeConfiguration = useCallback(
    (nodeId: string, patch: Partial<NodeConfiguration>) => {
      markDirty();
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        ),
      );
    },
    [setNodes, markDirty],
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

  const persistCurrent = useCallback(async () => {
    const payload = {
      name: workflowName,
      nodes: sanitizeNodes(nodes),
      edges,
    };

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
    return saved;
  }, [nodes, edges, workflowId, workflowName, refreshWorkflows]);

  const saveWorkflow = useCallback(async () => {
    setSaveState('saving');
    try {
      await persistCurrent();
    } catch (error) {
      if (isServerUnreachable(error)) {
        setApiStatus('offline');
      }
      setSaveState('error');
    }
  }, [persistCurrent]);

  const executeWorkflow = useCallback(async () => {
    if (runState === 'running') {
      return;
    }

    setRunState('running');
    setLastRun(null);
    const pending: Record<string, RunNodeStatus> = {};
    for (const node of nodes) {
      pending[node.id] = 'running';
    }
    setRunStatus(pending);

    try {
      let id = workflowId;
      if (!id || isDirty) {
        const saved = await persistCurrent();
        id = saved.id;
      }

      const run = await runWorkflowApi(id);
      const status: Record<string, RunNodeStatus> = {};
      for (const [nodeId, result] of Object.entries(run.nodes)) {
        status[nodeId] = result.status;
      }
      setRunStatus(status);
      setLastRun(run);
      setRunState(run.status === 'success' ? 'succeeded' : 'failed');
      setApiStatus('online');
    } catch (error) {
      if (isServerUnreachable(error)) {
        setApiStatus('offline');
      }
      setRunState('failed');
    }
  }, [runState, nodes, workflowId, isDirty, persistCurrent]);

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
    runStatus,
    lastRun,
    runState,
    executeWorkflow,
  };
}
