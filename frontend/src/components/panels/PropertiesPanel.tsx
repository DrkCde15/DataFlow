import { getCategoryLabel, getNodeDefinition } from '../../nodes/registry';
import type { NodeConfiguration, NodeStatus, WorkflowNode } from '../../types';
import { STATUS_LABELS } from '../../utils/theme';
import { Icon } from '../icons/Icon';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  onChange: (nodeId: string, patch: Partial<NodeConfiguration>) => void;
  onDelete: (nodeId: string) => void;
}

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as NodeStatus[];

export function PropertiesPanel({ node, onChange, onDelete }: PropertiesPanelProps) {
  if (!node) {
    return null;
  }

  const definition = getNodeDefinition(node.data.nodeType);
  const categoryLabel = definition
    ? getCategoryLabel(definition.category)
    : 'Uncategorized';

  return (
    <aside className="properties-panel">
      <header className="properties-panel__header">
        <span className="properties-panel__icon">
          {definition ? <Icon name={definition.icon} size={16} /> : null}
        </span>
        <div className="properties-panel__heading">
          <span className="properties-panel__eyebrow">Properties</span>
          <h2 className="properties-panel__title">{node.data.name}</h2>
        </div>
      </header>

      <div className="properties-panel__section">
        <div className="field">
          <label className="field__label" htmlFor="property-name">
            Name
          </label>
          <input
            id="property-name"
            className="field__input"
            type="text"
            value={node.data.name}
            onChange={(event) =>
              onChange(node.id, { name: event.target.value })
            }
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="property-description">
            Description
          </label>
          <textarea
            id="property-description"
            className="field__textarea"
            rows={3}
            value={node.data.description}
            onChange={(event) =>
              onChange(node.id, { description: event.target.value })
            }
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="property-status">
            Status
          </label>
          <select
            id="property-status"
            className="field__select"
            value={node.data.status}
            onChange={(event) =>
              onChange(node.id, { status: event.target.value as NodeStatus })
            }
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field__label">Category</span>
          <div className="properties-panel__meta">{categoryLabel}</div>
        </div>

        <div className="field">
          <span className="field__label">Type</span>
          <div className="properties-panel__meta properties-panel__meta--mono">
            {node.data.nodeType}
          </div>
        </div>

        <button
          type="button"
          className="properties-panel__delete"
          onClick={() => onDelete(node.id)}
        >
          <Icon name="trash" size={13} />
          Delete node
        </button>
      </div>
    </aside>
  );
}
