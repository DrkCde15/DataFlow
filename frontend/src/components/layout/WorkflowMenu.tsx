import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { WorkflowSummary } from '../../types';
import { formatUpdatedAt } from '../../utils/format';
import { Icon } from '../icons/Icon';
import './WorkflowMenu.css';

interface WorkflowMenuProps {
  workflowName: string;
  currentWorkflowId: string | null;
  workflows: WorkflowSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function WorkflowMenu({
  workflowName,
  currentWorkflowId,
  workflows,
  onOpen,
  onNew,
  onRename,
  onDelete,
}: WorkflowMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
    setEditingId(null);
    setPendingDeleteId(null);
  }

  function startRename(workflow: WorkflowSummary) {
    setPendingDeleteId(null);
    setEditingId(workflow.id);
    setEditValue(workflow.name);
  }

  function commitRename(id: string) {
    const name = editValue.trim();
    setEditingId(null);
    if (name) {
      onRename(id, name);
    }
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>, id: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRename(id);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingId(null);
    }
  }

  return (
    <div className="wf-menu" ref={containerRef}>
      <button
        type="button"
        className="wf-menu__trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Workflows"
      >
        <span className="wf-menu__trigger-name">{workflowName}</span>
        <Icon
          name="chevron-down"
          size={14}
          className={`wf-menu__chevron${isOpen ? ' wf-menu__chevron--open' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="wf-menu__panel" role="menu">
          <button
            type="button"
            className="wf-menu__new"
            onClick={() => {
              onNew();
              closeMenu();
            }}
          >
            <Icon name="logo" size={14} />
            New workflow
          </button>

          <ul className="wf-menu__list">
            {workflows.length === 0 && (
              <li className="wf-menu__empty">No saved workflows yet</li>
            )}
            {workflows.map((workflow) => {
              const isCurrent = workflow.id === currentWorkflowId;
              const isEditing = editingId === workflow.id;
              const isPendingDelete = pendingDeleteId === workflow.id;

              return (
                <li
                  key={workflow.id}
                  className={`wf-menu__item${isCurrent ? ' wf-menu__item--current' : ''}`}
                >
                  {isEditing ? (
                    <input
                      className="wf-menu__edit-input"
                      value={editValue}
                      autoFocus
                      onChange={(event) => setEditValue(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => handleEditKeyDown(event, workflow.id)}
                      onBlur={() => setEditingId(null)}
                      aria-label="Workflow name"
                    />
                  ) : (
                    <button
                      type="button"
                      className="wf-menu__open"
                      onClick={() => {
                        onOpen(workflow.id);
                        closeMenu();
                      }}
                    >
                      <span className="wf-menu__name">
                        {workflow.name}
                        {isCurrent && (
                          <span className="wf-menu__badge">current</span>
                        )}
                      </span>
                      <span className="wf-menu__meta">
                        {formatUpdatedAt(workflow.updatedAt)} · {workflow.nodeCount}{' '}
                        {workflow.nodeCount === 1 ? 'node' : 'nodes'}
                      </span>
                    </button>
                  )}

                  <div className="wf-menu__actions">
                    {isPendingDelete ? (
                      <>
                        <button
                          type="button"
                          className="wf-menu__action wf-menu__action--danger"
                          onClick={() => {
                            onDelete(workflow.id);
                            setPendingDeleteId(null);
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="wf-menu__action"
                          onClick={() => setPendingDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      !isEditing && (
                        <>
                          <button
                            type="button"
                            className="wf-menu__action"
                            title="Rename"
                            onClick={() => startRename(workflow)}
                          >
                            <Icon name="pencil" size={13} />
                          </button>
                          <button
                            type="button"
                            className="wf-menu__action wf-menu__action--danger"
                            title="Delete"
                            onClick={() => {
                              setEditingId(null);
                              setPendingDeleteId(workflow.id);
                            }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
