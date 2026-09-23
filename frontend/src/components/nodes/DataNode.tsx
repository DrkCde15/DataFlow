import { useState, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getCategoryLabel, getNodeDefinition } from '../../nodes/registry';
import type { WorkflowNode } from '../../types';
import { STATUS_LABELS } from '../../utils/theme';
import { Icon } from '../icons/Icon';
import { useNodeActions } from './nodeActions';
import './DataNode.css';

export function DataNode({ id, data, selected }: NodeProps<WorkflowNode>) {
  const { updateNode, deleteNode } = useNodeActions();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const definition = getNodeDefinition(data.nodeType);
  const categoryLabel = definition
    ? getCategoryLabel(definition.category)
    : 'Node';
  const statusLabel = STATUS_LABELS[data.status];

  function startEditName() {
    setDraftName(data.name);
    setIsEditingName(true);
  }

  function commitName() {
    const name = draftName.trim();
    setIsEditingName(false);
    if (name && name !== data.name) {
      updateNode(id, { name });
    }
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitName();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setDraftName('');
      setIsEditingName(false);
    }
  }

  return (
    <div
      className={`wf-node wf-node--${definition?.category ?? 'sources'}${selected ? ' wf-node--selected' : ''}`}
      data-status={data.status}
    >
      <div className="wf-node__header">
        <span className="wf-node__icon">
          {definition ? <Icon name={definition.icon} size={14} /> : null}
        </span>
        <span className="wf-node__titles">
          {isEditingName ? (
            <input
              className="wf-node__name-input nodrag nopan"
              value={draftName}
              autoFocus
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={commitName}
              onClick={(event) => event.stopPropagation()}
              aria-label="Node name"
            />
          ) : (
            <span className="wf-node__name">{data.name}</span>
          )}
          <span className="wf-node__category">{categoryLabel}</span>
        </span>
        <span className="wf-node__status" title={statusLabel} />
        <div className="wf-node__actions">
          <button
            type="button"
            className="wf-node__action nodrag"
            title="Rename"
            onClick={startEditName}
          >
            <Icon name="pencil" size={12} />
          </button>
          <button
            type="button"
            className="wf-node__action wf-node__action--danger nodrag"
            title="Delete node"
            onClick={() => deleteNode(id)}
          >
            <Icon name="trash" size={12} />
          </button>
        </div>
      </div>
      <div className="wf-node__description">{data.description}</div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
