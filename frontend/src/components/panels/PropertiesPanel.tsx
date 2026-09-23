import { useState } from 'react';
import { uploadFile } from '../../api/client';
import { getCategoryLabel, getNodeDefinition } from '../../nodes/registry';
import type {
  ConfigField,
  ConfigValue,
  FileAttachment,
  NodeConfiguration,
  NodeStatus,
  WorkflowNode,
} from '../../types';
import { formatBytes } from '../../utils/format';
import { STATUS_LABELS } from '../../utils/theme';
import { Icon } from '../icons/Icon';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  onChange: (nodeId: string, patch: Partial<NodeConfiguration>) => void;
  onDelete: (nodeId: string) => void;
}

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as NodeStatus[];

function isFileAttachment(value: ConfigValue): value is FileAttachment {
  return typeof value === 'object' && value !== null && 'id' in value;
}

export function PropertiesPanel({ node, onChange, onDelete }: PropertiesPanelProps) {
  const [uploading, setUploading] = useState<{
    nodeId: string;
    key: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<{
    nodeId: string;
    key: string;
    message: string;
  } | null>(null);

  if (!node) {
    return null;
  }

  const definition = getNodeDefinition(node.data.nodeType);
  const categoryLabel = definition
    ? getCategoryLabel(definition.category)
    : 'Uncategorized';
  const config = node.data.config ?? {};
  const schema = definition?.configSchema ?? [];

  function setConfigValue(key: string, value: ConfigValue) {
    onChange(node!.id, { config: { ...config, [key]: value } });
  }

  async function handleFileChange(field: ConfigField, selected: File | null) {
    if (!selected) {
      return;
    }

    setUploadError(null);
    setUploading({ nodeId: node!.id, key: field.key });

    try {
      const uploaded = await uploadFile(selected);
      setConfigValue(field.key, uploaded);
    } catch {
      setUploadError({
        nodeId: node!.id,
        key: field.key,
        message: `Failed to upload ${selected.name}`,
      });
    } finally {
      setUploading(null);
    }
  }

  function fieldInputValue(field: ConfigField): string {
    const value = config[field.key] ?? field.defaultValue ?? '';
    if (typeof value === 'object' && value !== null && 'filename' in value) {
      return value.filename;
    }
    return String(value);
  }

  function renderFileField(field: ConfigField) {
    const value = config[field.key];
    const attachment = isFileAttachment(value) ? value : null;
    const isUploading =
      uploading?.nodeId === node!.id && uploading.key === field.key;
    const error =
      uploadError?.nodeId === node!.id && uploadError.key === field.key
        ? uploadError.message
        : null;

    return (
      <div className="file-field">
        <div className="file-field__current">
          {attachment ? (
            <>
              <Icon name="file" size={14} className="file-field__icon" />
              <span className="file-field__name" title={attachment.filename}>
                {attachment.filename}
              </span>
              <span className="file-field__size">
                {formatBytes(attachment.size)}
              </span>
            </>
          ) : (
            <span className="file-field__empty">No file selected</span>
          )}
        </div>

        <div className="file-field__actions">
          <label
            className={`file-field__button${isUploading ? ' file-field__button--busy' : ''}`}
          >
            {isUploading
              ? 'Uploading…'
              : attachment
                ? 'Replace'
                : 'Choose file'}
            <input
              type="file"
              className="file-field__input"
              accept={field.accept}
              disabled={isUploading}
              onChange={(event) => {
                void handleFileChange(field, event.target.files?.[0] ?? null);
                event.target.value = '';
              }}
            />
          </label>
          {attachment && !isUploading && (
            <button
              type="button"
              className="file-field__remove"
              onClick={() => setConfigValue(field.key, null)}
            >
              Remove
            </button>
          )}
        </div>

        {error && <span className="file-field__error">{error}</span>}
      </div>
    );
  }

  function renderConfigField(field: ConfigField) {
    if (field.type === 'file') {
      return renderFileField(field);
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          id={`config-${field.key}`}
          className="field__textarea"
          rows={3}
          placeholder={field.placeholder}
          value={fieldInputValue(field)}
          onChange={(event) => setConfigValue(field.key, event.target.value)}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          id={`config-${field.key}`}
          className="field__select"
          value={fieldInputValue(field)}
          onChange={(event) => setConfigValue(field.key, event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          id={`config-${field.key}`}
          className="field__input"
          type="number"
          placeholder={field.placeholder}
          value={fieldInputValue(field)}
          onChange={(event) =>
            setConfigValue(
              field.key,
              event.target.value === '' ? null : Number(event.target.value),
            )
          }
        />
      );
    }

    return (
      <input
        id={`config-${field.key}`}
        className="field__input"
        type="text"
        placeholder={field.placeholder}
        value={fieldInputValue(field)}
        onChange={(event) => setConfigValue(field.key, event.target.value)}
      />
    );
  }

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

        {schema.length > 0 && (
          <div className="properties-panel__config">
            <span className="properties-panel__section-label">
              Configuration
            </span>
            {schema.map((field) => (
              <div className="field" key={field.key}>
                <label
                  className="field__label"
                  htmlFor={
                    field.type === 'file'
                      ? undefined
                      : `config-${field.key}`
                  }
                >
                  {field.label}
                  {field.required && (
                    <span className="field__required"> *</span>
                  )}
                </label>
                {renderConfigField(field)}
              </div>
            ))}
          </div>
        )}

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
