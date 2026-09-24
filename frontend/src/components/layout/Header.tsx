import type { RunState, SaveState } from '../../types';
import { Icon } from '../icons/Icon';
import './Header.css';

interface HeaderProps {
  workflowName: string;
  saveState: SaveState;
  runState: RunState;
  onBack: () => void;
  onSave: () => void;
  onExecute: () => void;
}

export function Header({
  workflowName,
  saveState,
  runState,
  onBack,
  onSave,
  onExecute,
}: HeaderProps) {
  const isSaving = saveState === 'saving';

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <button
          type="button"
          className="btn btn--icon"
          onClick={onBack}
          aria-label="All workflows"
          title="All workflows"
        >
          <Icon name="chevron-left" size={15} />
        </button>
        <span className="app-header__logo">
          <Icon name="logo" size={18} />
        </span>
        <span className="app-header__product">DataFlow</span>
        <span className="app-header__divider" />
        <span className="app-header__workflow">{workflowName}</span>
      </div>

      <div className="app-header__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onSave}
          disabled={isSaving}
          title={
            saveState === 'error'
              ? 'Last save failed — is the API running?'
              : 'Save workflow'
          }
        >
          <Icon name="save" size={14} />
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={runState === 'running'}
          onClick={onExecute}
          title="Run workflow"
        >
          <Icon name="play" size={13} />
          {runState === 'running' ? 'Running…' : 'Execute'}
        </button>
        <button
          type="button"
          className="btn btn--icon"
          aria-label="Settings"
          title="Settings"
        >
          <Icon name="settings" size={15} />
        </button>
      </div>
    </header>
  );
}
