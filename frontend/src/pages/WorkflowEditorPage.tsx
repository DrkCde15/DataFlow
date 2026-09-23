import { useEffect, useMemo } from 'react';
import { WorkflowCanvas } from '../components/canvas/WorkflowCanvas';
import { Header } from '../components/layout/Header';
import { StatusBar } from '../components/layout/StatusBar';
import { NodeActionsContext } from '../components/nodes/nodeActions';
import { PropertiesPanel } from '../components/panels/PropertiesPanel';
import { NodeLibrary } from '../components/sidebar/NodeLibrary';
import { useWorkflow } from '../hooks/useWorkflow';
import './WorkflowEditorPage.css';

export function WorkflowEditorPage() {
  const {
    nodes,
    edges,
    selectedNode,
    workflowId,
    workflowName,
    workflows,
    saveState,
    apiStatus,
    isDirty,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    updateNodeConfiguration,
    loadInitialWorkflow,
    saveWorkflow,
    openWorkflow,
    createNewWorkflow,
    renameWorkflow,
    deleteWorkflow,
  } = useWorkflow();

  useEffect(() => {
    void loadInitialWorkflow();
  }, [loadInitialWorkflow]);

  const nodeActions = useMemo(
    () => ({
      updateNode: updateNodeConfiguration,
      deleteNode,
    }),
    [updateNodeConfiguration, deleteNode],
  );

  return (
    <div className="workflow-editor">
      <Header
        workflowName={workflowName}
        currentWorkflowId={workflowId}
        workflows={workflows}
        saveState={saveState}
        onSave={() => void saveWorkflow()}
        onOpenWorkflow={(id) => void openWorkflow(id)}
        onNewWorkflow={createNewWorkflow}
        onRenameWorkflow={(id, name) => void renameWorkflow(id, name)}
        onDeleteWorkflow={(id) => void deleteWorkflow(id)}
      />
      <div className="workflow-editor__body">
        <NodeLibrary />
        <NodeActionsContext.Provider value={nodeActions}>
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onAddNode={addNode}
          />
        </NodeActionsContext.Provider>
        <PropertiesPanel
          node={selectedNode}
          onChange={updateNodeConfiguration}
          onDelete={deleteNode}
        />
      </div>
      <StatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        selectedNodeName={selectedNode?.data.name ?? null}
        apiStatus={apiStatus}
        saveState={saveState}
        isDirty={isDirty}
      />
    </div>
  );
}
