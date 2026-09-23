import type {
  WorkflowPayload,
  WorkflowRecord,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Request failed: ${response.status}`);
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
