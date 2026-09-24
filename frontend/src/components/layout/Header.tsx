import type { RunState, SaveState, WorkflowSummary } from '../../types';
import { Icon } from '../icons/Icon';
import { WorkflowMenu } from './WorkflowMenu';
import './Header.css';

interface HeaderProps {
  workflowName: string;
  currentWorkflowId: string | null;
  workflows: WorkflowSummary[];
  saveState: SaveState;
  runState: RunState;
  onSave: () => void;
  onExecute: () => void;
  onOpenWorkflow: (id: string) => void;
  onNewWorkflow: () => void;
  onRenameWorkflow: (id: string, name: string) => void;
  onDeleteWorkflow: (id: string) => void;
}

export function Header({
  workflowName,
  currentWorkflowId,
  workflows,
  saveState,
  runState,
  onSave,
  onExecute,
  onOpenWorkflow,
  onNewWorkflow,
  onRenameWorkflow,
  onDeleteWorkflow,
}: HeaderProps) {
  const isSaving = saveState === 'saving';

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo">
          <Icon name="logo" size={18} />
        </span>
        <span className="app-header__product">DataFlow</span>
        <span className="app-header__divider" />
        <WorkflowMenu
          workflowName={workflowName}
          currentWorkflowId={currentWorkflowId}
          workflows={workflows}
          onOpen={onOpenWorkflow}
          onNew={onNewWorkflow}
          onRename={onRenameWorkflow}
          onDelete={onDeleteWorkflow}
        />
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
