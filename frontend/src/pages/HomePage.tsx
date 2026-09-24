import { useEffect, useState, type KeyboardEvent } from 'react';
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflows,
  renameWorkflow,
} from '../api/client';
import { DEMO_WORKFLOW_NAME, demoEdges, demoNodes } from '../data/demoWorkflow';
import type { WorkflowSummary } from '../types';
import { formatUpdatedAt } from '../utils/format';
import { Icon } from '../components/icons/Icon';
import './HomePage.css';

interface HomePageProps {
  onOpenWorkflow: (id: string) => void;
  onCreateWorkflow: () => void;
}

export function HomePage({ onOpenWorkflow, onCreateWorkflow }: HomePageProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const list = await listWorkflows();
      setWorkflows(list);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    listWorkflows().then(
      (list) => {
        setWorkflows(list);
        setLoading(false);
      },
      () => {
        setOffline(true);
        setLoading(false);
      },
    );
  }, []);

  async function handleCreateDemo() {
    setBusy(true);
    setError(null);
    try {
      const created = await createWorkflow({
        name: DEMO_WORKFLOW_NAME,
        nodes: demoNodes,
        edges: demoEdges,
      });
      onOpenWorkflow(created.id);
    } catch {
      setError('Could not create the demo workflow. Is the API running?');
    } finally {
      setBusy(false);
    }
  }

  function startRename(workflow: WorkflowSummary) {
    setPendingDeleteId(null);
    setEditingId(workflow.id);
    setEditValue(workflow.name);
  }

  async function commitRename(id: string) {
    const name = editValue.trim();
    setEditingId(null);
    if (!name) {
      return;
    }
    setError(null);
    try {
      await renameWorkflow(id, name);
      await refresh();
    } catch {
      setError('Could not rename the workflow.');
    }
  }

  function handleRenameKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    id: string,
  ) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitRename(id);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteWorkflow(id);
      setPendingDeleteId(null);
      await refresh();
    } catch {
      setError('Could not delete the workflow.');
      setPendingDeleteId(null);
    }
  }

  const visible = workflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="home">
      <header className="home__topbar">
        <div className="home__brand">
          <span className="app-header__logo">
            <Icon name="logo" size={18} />
          </span>
          <span className="app-header__product">DataFlow</span>
        </div>
        <div className="home__topbar-actions">
          <input
            className="home__search"
            type="search"
            placeholder="Search workflows…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search workflows"
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={onCreateWorkflow}
          >
            + New workflow
          </button>
        </div>
      </header>

      <main className="home__main">
        <div className="home__heading">
          <h1 className="home__title">Workflows</h1>
          <p className="home__subtitle">
            Build data pipelines visually. Open a workflow to edit and run it.
          </p>
        </div>

        {error && <div className="home__error">{error}</div>}

        {loading ? (
          <p className="home__status">Loading…</p>
        ) : offline ? (
          <div className="home__empty">
            <p className="home__empty-title">API offline</p>
            <p className="home__empty-text">
              Start the backend to manage workflows.
            </p>
            <button type="button" className="btn btn--ghost" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : visible.length === 0 && workflows.length === 0 ? (
          <div className="home__empty">
            <p className="home__empty-title">No workflows yet</p>
            <p className="home__empty-text">
              Create your first pipeline or start from the demo.
            </p>
            <div className="home__empty-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={onCreateWorkflow}
              >
                + New workflow
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => void handleCreateDemo()}
              >
                {busy ? 'Loading…' : 'Load demo'}
              </button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="home__status">No workflows match “{search}”.</p>
        ) : (
          <ul className="home__grid">
            {visible.map((workflow) => (
              <li
                key={workflow.id}
                className={`home__card${pendingDeleteId === workflow.id ? ' home__card--confirm' : ''}`}
              >
                {editingId === workflow.id ? (
                  <input
                    className="home__rename-input"
                    value={editValue}
                    autoFocus
                    onChange={(event) => setEditValue(event.target.value)}
                    onKeyDown={(event) => handleRenameKeyDown(event, workflow.id)}
                    onBlur={() => setEditingId(null)}
                    aria-label="Workflow name"
                  />
                ) : (
                  <button
                    type="button"
                    className="home__open"
                    onClick={() => onOpenWorkflow(workflow.id)}
                    title="Open workflow"
                  >
                    <span className="home__name">{workflow.name}</span>
                    <span className="home__meta">
                      {formatUpdatedAt(workflow.updatedAt)} · {workflow.nodeCount}{' '}
                      {workflow.nodeCount === 1 ? 'node' : 'nodes'} ·{' '}
                      {workflow.edgeCount}{' '}
                      {workflow.edgeCount === 1 ? 'connection' : 'connections'}
                    </span>
                  </button>
                )}

                <div className="home__card-actions">
                  {pendingDeleteId === workflow.id ? (
                    <>
                      <button
                        type="button"
                        className="home__action home__action--danger"
                        onClick={() => void handleDelete(workflow.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="home__action"
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    editingId !== workflow.id && (
                      <>
                        <button
                          type="button"
                          className="home__action"
                          title="Rename"
                          onClick={() => startRename(workflow)}
                        >
                          <Icon name="pencil" size={13} />
                        </button>
                        <button
                          type="button"
                          className="home__action home__action--danger"
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
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
