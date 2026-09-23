import type { NodeCategory, NodeStatus } from '../types';

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  sources: '#3b82f6',
  processing: '#8b5cf6',
  quality: '#f59e0b',
  storage: '#10b981',
  orchestration: '#f43f5e',
};

export const STATUS_LABELS: Record<NodeStatus, string> = {
  ready: 'Ready',
  draft: 'Draft',
  error: 'Error',
  disabled: 'Disabled',
};

export function applyThemeColorVars(): void {
  const root = document.documentElement;
  (Object.keys(CATEGORY_COLORS) as NodeCategory[]).forEach((category) => {
    root.style.setProperty(`--cat-${category}`, CATEGORY_COLORS[category]);
  });
}
