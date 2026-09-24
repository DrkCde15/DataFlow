import { useState, type FormEvent } from 'react';
import type {
  ConnectionInput,
  ConnectionPatch,
  ConnectionSummary,
} from '../../types';
import { formatUpdatedAt } from '../../utils/format';
import { Icon } from '../icons/Icon';
import './ConnectionManager.css';

interface ConnectionManagerProps {
  connections: ConnectionSummary[];
  onClose: () => void;
  onCreate: (input: ConnectionInput) => Promise<ConnectionSummary>;
  onUpdate: (id: string, patch: ConnectionPatch) => Promise<ConnectionSummary>;
  onDelete: (id: string) => Promise<void>;
}

const CONNECTION_TYPES = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'warehouse', label: 'Data Warehouse' },
  { value: 'other', label: 'Other' },
];

function typeLabel(type: string): string {
  return CONNECTION_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export function ConnectionManager({
  connections,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: ConnectionManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [connType, setConnType] = useState('postgres');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isEditing = editingId !== null;
  const showForm = isCreating || isEditing;

  function resetForm() {
    setIsCreating(false);
    setEditingId(null);
    setName('');
    setConnType('postgres');
    setSecret('');
    setError(null);
  }

  function startCreate() {
    setPendingDeleteId(null);
    setIsCreating(true);
    setEditingId(null);
    setName('');
    setConnType('postgres');
    setSecret('');
    setError(null);
  }

  function startEdit(connection: ConnectionSummary) {
    setPendingDeleteId(null);
    setIsCreating(false);
    setEditingId(connection.id);
    setName(connection.name);
    setConnType(connection.type);
    setSecret('');
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!isEditing && !secret) {
      setError('Connection string is required');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (isEditing && editingId) {
        const patch: ConnectionPatch = { name: name.trim(), type: connType };
        if (secret) {
          patch.connectionString = secret;
        }
        await onUpdate(editingId, patch);
      } else {
        await onCreate({
          name: name.trim(),
          type: connType,
          connectionString: secret,
        });
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await onDelete(id);
      setPendingDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="conn-modal" role="dialog" aria-modal="true" aria-label="Connections">
      <div className="conn-modal__overlay" onClick={onClose} />
      <div className="conn-modal__panel">
        <header className="conn-modal__header">
          <div>
            <h2 className="conn-modal__title">Connections</h2>
            <p className="conn-modal__subtitle">
              Credentials are stored server-side and never shown again.
            </p>
          </div>
          <button
            type="button"
            className="conn-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="conn-modal__body">
          {error && <div className="conn-modal__error">{error}</div>}

          <ul className="conn-modal__list">
            {connections.length === 0 && (
              <li className="conn-modal__empty">No connections yet</li>
            )}
            {connections.map((connection) => (
              <li key={connection.id} className="conn-modal__item">
                <div className="conn-modal__info">
                  <span className="conn-modal__name">{connection.name}</span>
                  <span className="conn-modal__meta">
                    {typeLabel(connection.type)} · updated{' '}
                    {formatUpdatedAt(connection.updatedAt)}
                  </span>
                </div>
                <div className="conn-modal__actions">
                  {pendingDeleteId === connection.id ? (
                    <>
                      <button
                        type="button"
                        className="conn-modal__action conn-modal__action--danger"
                        onClick={() => void handleDelete(connection.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="conn-modal__action"
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="conn-modal__action"
                        title="Edit"
                        onClick={() => startEdit(connection)}
                      >
                        <Icon name="pencil" size={13} />
                      </button>
                      <button
                        type="button"
                        className="conn-modal__action conn-modal__action--danger"
                        title="Delete"
                        onClick={() => setPendingDeleteId(connection.id)}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {showForm ? (
            <form
              className="conn-modal__form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="field">
                <label className="field__label" htmlFor="conn-name">
                  Name
                </label>
                <input
                  id="conn-name"
                  className="field__input"
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Production PostgreSQL"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="conn-type">
                  Type
                </label>
                <select
                  id="conn-type"
                  className="field__select"
                  value={connType}
                  onChange={(event) => setConnType(event.target.value)}
                >
                  {CONNECTION_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="conn-secret">
                  Connection string
                </label>
                <input
                  id="conn-secret"
                  className="field__input"
                  type="password"
                  autoComplete="off"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder={
                    isEditing
                      ? 'Leave blank to keep the current value'
                      : 'postgresql://user:pass@host:5432/db'
                  }
                />
              </div>
              <div className="conn-modal__form-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={resetForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={busy}
                >
                  {busy
                    ? 'Saving…'
                    : isEditing
                      ? 'Save changes'
                      : 'Create connection'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="conn-modal__new"
              onClick={startCreate}
            >
              + New connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
