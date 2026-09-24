import type { Edge, Node } from '@xyflow/react';

export type NodeCategory =
  | 'sources'
  | 'processing'
  | 'quality'
  | 'storage'
  | 'orchestration';

export type NodeStatus = 'ready' | 'draft' | 'error' | 'disabled';

export type ConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'file'
  | 'connection';

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  placeholder?: string;
  options?: ConfigFieldOption[];
  defaultValue?: string | number;
  required?: boolean;
  accept?: string;
  connectionType?: string;
}

export interface FileAttachment {
  id: string;
  filename: string;
  size: number;
}

export type ConfigValue = string | number | FileAttachment | null;

export type NodeConfig = Record<string, ConfigValue>;

export type IconName =
  | 'rest-api'
  | 'file'
  | 'json'
  | 'database'
  | 'server'
  | 'web-scraping'
  | 'python'
  | 'sql'
  | 'pyspark'
  | 'filter'
  | 'join'
  | 'aggregate'
  | 'schema-validation'
  | 'null-check'
  | 'duplicate-check'
  | 'freshness'
  | 'parquet'
  | 'delta-lake'
  | 'data-warehouse'
  | 'schedule'
  | 'trigger'
  | 'condition'
  | 'logo'
  | 'save'
  | 'settings'
  | 'play'
  | 'chevron-down'
  | 'pencil'
  | 'trash';

export interface NodeCategoryMeta {
  id: NodeCategory;
  label: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: IconName;
  configSchema?: ConfigField[];
}

export interface NodeConfiguration {
  name: string;
  description: string;
  status: NodeStatus;
  config?: NodeConfig;
}

export interface WorkflowNodeData extends NodeConfiguration {
  nodeType: string;
  [key: string]: unknown;
}

export type WorkflowNode = Node<WorkflowNodeData>;

export type WorkflowEdge = Edge;

export type ApiStatus = 'unknown' | 'online' | 'offline';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface WorkflowSummary {
  id: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRecord {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowPayload {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ConnectionSummary {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionInput {
  name: string;
  type: string;
  connectionString?: string;
}

export interface ConnectionPatch {
  name?: string;
  type?: string;
  connectionString?: string;
}
