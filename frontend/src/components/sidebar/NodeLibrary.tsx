import type { DragEvent } from 'react';
import { NODE_CATEGORIES, getNodeDefinitionsByCategory } from '../../nodes/registry';
import { NODE_DRAG_MIME_TYPE } from '../../utils/dnd';
import { Icon } from '../icons/Icon';
import './NodeLibrary.css';

function handleItemDragStart(
  event: DragEvent<HTMLButtonElement>,
  nodeType: string,
) {
  event.dataTransfer.setData(NODE_DRAG_MIME_TYPE, nodeType);
  event.dataTransfer.effectAllowed = 'move';
}

export function NodeLibrary() {
  return (
    <aside className="node-library">
      <div className="node-library__header">
        <h2 className="node-library__title">Node Library</h2>
        <span className="node-library__hint">Drag to canvas</span>
      </div>
      <div className="node-library__scroll">
        {NODE_CATEGORIES.map((category) => (
          <section
            key={category.id}
            className={`node-category node-category--${category.id}`}
          >
            <h3 className="node-category__title">
              <span className="node-category__dot" />
              {category.label}
            </h3>
            <ul className="node-category__list">
              {getNodeDefinitionsByCategory(category.id).map((definition) => (
                <li key={definition.type}>
                  <button
                    type="button"
                    className="node-library-item"
                    draggable
                    onDragStart={(event) =>
                      handleItemDragStart(event, definition.type)
                    }
                  >
                    <span className="node-library-item__icon">
                      <Icon name={definition.icon} size={14} />
                    </span>
                    <span className="node-library-item__label">
                      {definition.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
