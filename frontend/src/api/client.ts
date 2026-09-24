import type {
  ConnectionInput,
  ConnectionPatch,
  ConnectionSummary,
  WorkflowPayload,
  WorkflowRecord,
  WorkflowRun,
  WorkflowSummary,
} from '../types';

const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8000';

interface ApiWorkflowSummary {
  id: string;
  name: string;
  node_count: number;
  edge_count: number;
  created_at: string;
  updated_at: string;
}

interface ApiWorkflowRecord {
  id: string;
  name: string;
  nodes: WorkflowRecord['nodes'];
  edges: WorkflowRecord['edges'];
  created_at: string;
  updated_at: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isServerUnreachable(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string' && body.detail) {
        message = body.detail;
      }
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function toSummary(raw: ApiWorkflowSummary): WorkflowSummary {
  return {
    id: raw.id,
    name: raw.name,
    nodeCount: raw.node_count,
    edgeCount: raw.edge_count,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function toRecord(raw: ApiWorkflowRecord): WorkflowRecord {
  return {
    id: raw.id,
    name: raw.name,
    nodes: raw.nodes,
    edges: raw.edges,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const raw = await request<ApiWorkflowSummary[]>('/api/workflows');
  return raw.map(toSummary);
}

export async function fetchWorkflow(id: string): Promise<WorkflowRecord> {
  const raw = await request<ApiWorkflowRecord>(`/api/workflows/${id}`);
  return toRecord(raw);
}

export async function createWorkflow(
  payload: WorkflowPayload,
): Promise<WorkflowRecord> {
  const raw = await request<ApiWorkflowRecord>('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toRecord(raw);
}

export async function updateWorkflow(
  id: string,
  payload: WorkflowPayload,
): Promise<WorkflowRecord> {
  const raw = await request<ApiWorkflowRecord>(`/api/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return toRecord(raw);
}

export async function renameWorkflow(
  id: string,
  name: string,
): Promise<WorkflowRecord> {
  const raw = await request<ApiWorkflowRecord>(`/api/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
  return toRecord(raw);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await request<void>(`/api/workflows/${id}`, { method: 'DELETE' });
}

interface ApiConnectionSummary {
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
}

function toConnectionSummary(raw: ApiConnectionSummary): ConnectionSummary {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function listConnections(): Promise<ConnectionSummary[]> {
  const raw = await request<ApiConnectionSummary[]>('/api/connections');
  return raw.map(toConnectionSummary);
}

export async function createConnection(
  input: ConnectionInput,
): Promise<ConnectionSummary> {
  const raw = await request<ApiConnectionSummary>('/api/connections', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      type: input.type,
      connection_string: input.connectionString,
    }),
  });
  return toConnectionSummary(raw);
}

export async function updateConnection(
  id: string,
  patch: ConnectionPatch,
): Promise<ConnectionSummary> {
  const body: Record<string, string> = {};
  if (patch.name !== undefined) {
    body.name = patch.name;
  }
  if (patch.type !== undefined) {
    body.type = patch.type;
  }
  if (patch.connectionString !== undefined) {
    body.connection_string = patch.connectionString;
  }
  const raw = await request<ApiConnectionSummary>(`/api/connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return toConnectionSummary(raw);
}

export async function deleteConnection(id: string): Promise<void> {
  await request<void>(`/api/connections/${id}`, { method: 'DELETE' });
}

interface ApiNodeRunResult {
  status: 'success' | 'failed' | 'error';
  rows: number;
  columns: string[];
  log: string[];
  error: string | null;
}

interface ApiWorkflowRun {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  finished_at: string;
  nodes: Record<string, ApiNodeRunResult>;
}

export async function runWorkflow(id: string): Promise<WorkflowRun> {
  const raw = await request<ApiWorkflowRun>(`/api/workflows/${id}/run`, {
    method: 'POST',
  });
  return {
    id: raw.id,
    workflowId: raw.workflow_id,
    status: raw.status,
    startedAt: raw.started_at,
    finishedAt: raw.finished_at,
    nodes: raw.nodes,
  };
}

export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
}

export async function uploadFile(file: globalThis.File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/files`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Upload failed: ${response.status}`);
  }

  return (await response.json()) as UploadedFile;
}
