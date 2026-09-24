import type { ApiStatus, RunState, SaveState } from '../../types';
import './StatusBar.css';

interface StatusBarProps {
  nodeCount: number;
  edgeCount: number;
  selectedNodeName: string | null;
  apiStatus: ApiStatus;
  saveState: SaveState;
  isDirty: boolean;
  runState: RunState;
}

function getApiLabel(apiStatus: ApiStatus): string {
  if (apiStatus === 'online') {
    return 'API online';
  }
  if (apiStatus === 'offline') {
    return 'API offline';
  }
  return 'API —';
}

function getRunLabel(runState: RunState): { label: string; tone: string } | null {
  if (runState === 'running') {
    return { label: 'Run: running…', tone: 'warning' };
  }
  if (runState === 'succeeded') {
    return { label: 'Run: succeeded', tone: 'success' };
  }
  if (runState === 'failed') {
    return { label: 'Run: failed', tone: 'danger' };
  }
  return null;
}

function getSaveLabel(
  saveState: SaveState,
  isDirty: boolean,
): { label: string; tone: string } {
  if (saveState === 'saving') {
    return { label: 'Saving…', tone: '' };
  }
  if (saveState === 'error') {
    return { label: 'Save failed', tone: 'danger' };
  }
  if (isDirty) {
    return { label: 'Unsaved changes', tone: 'warning' };
  }
  if (saveState === 'saved') {
    return { label: 'Saved', tone: 'success' };
  }
  return { label: 'Not saved yet', tone: '' };
}

export function StatusBar({
  nodeCount,
  edgeCount,
  selectedNodeName,
  apiStatus,
  saveState,
  isDirty,
  runState,
}: StatusBarProps) {
  const save = getSaveLabel(saveState, isDirty);
  const run = getRunLabel(runState);

  return (
    <footer className="status-bar">
      <div className="status-bar__group">
        <span
          className={`status-bar__item status-bar__item--status status-bar__item--api-${apiStatus}`}
        >
          <span className="status-bar__dot" />
          {getApiLabel(apiStatus)}
        </span>
        <span className="status-bar__item">
          {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
        </span>
        <span className="status-bar__item">
          {edgeCount} {edgeCount === 1 ? 'connection' : 'connections'}
        </span>
        <span
          className={`status-bar__item${save.tone ? ` status-bar__item--${save.tone}` : ''}`}
        >
          {save.label}
        </span>
        {run && (
          <span className={`status-bar__item status-bar__item--${run.tone}`}>
            {run.label}
          </span>
        )}
      </div>

      <div className="status-bar__group">
        <span className="status-bar__item">
          {selectedNodeName
            ? `Selected: ${selectedNodeName}`
            : 'No node selected'}
        </span>
      </div>
    </footer>
  );
}
