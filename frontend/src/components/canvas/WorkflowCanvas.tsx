import { useCallback, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import { getNodeDefinition } from '../../nodes/registry';
import type { WorkflowEdge, WorkflowNode } from '../../types';
import { CATEGORY_COLORS } from '../../utils/theme';
import { NODE_DRAG_MIME_TYPE } from '../../utils/dnd';
import { workflowNodeTypes } from '../nodes/workflowNodeTypes';
import './WorkflowCanvas.css';

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  onAddNode: (nodeType: string, position: XYPosition) => void;
}

function WorkflowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddNode,
}: WorkflowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData(NODE_DRAG_MIME_TYPE);
      if (!nodeType) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onAddNode(nodeType, position);
    },
    [onAddNode, screenToFlowPosition],
  );

  const miniMapNodeColor = useCallback((node: WorkflowNode) => {
    const definition = getNodeDefinition(node.data.nodeType);
    return definition
      ? CATEGORY_COLORS[definition.category]
      : CATEGORY_COLORS.sources;
  }, []);

  return (
    <div className="workflow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={workflowNodeTypes}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="var(--canvas-grid)"
        />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          nodeColor={miniMapNodeColor}
          maskColor="rgba(6, 9, 15, 0.72)"
          bgColor="var(--bg-surface)"
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
