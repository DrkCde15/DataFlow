import { useEffect, useMemo, useRef, useState } from 'react';
import { WorkflowCanvas } from '../components/canvas/WorkflowCanvas';
import { ConnectionManager } from '../components/connections/ConnectionManager';
import { Header } from '../components/layout/Header';
import { StatusBar } from '../components/layout/StatusBar';
import { NodeActionsContext } from '../components/nodes/nodeActions';
import { PropertiesPanel } from '../components/panels/PropertiesPanel';
import { NodeLibrary } from '../components/sidebar/NodeLibrary';
import { useWorkflow } from '../hooks/useWorkflow';
import './WorkflowEditorPage.css';

interface WorkflowEditorPageProps {
  workflowId: string | null;
  onBack: () => void;
}

export function WorkflowEditorPage({ workflowId, onBack }: WorkflowEditorPageProps) {
  const {
    nodes,
    edges,
    selectedNode,
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
    saveWorkflow,
    openWorkflow,
    createNewWorkflow,
    refreshWorkflows,
    connections,
    refreshConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    runStatus,
    lastRun,
    runState,
    executeWorkflow,
  } = useWorkflow();

  const [isConnectionManagerOpen, setIsConnectionManagerOpen] = useState(false);
  const initializedFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (initializedFor.current === workflowId) {
      return;
    }
    initializedFor.current = workflowId;

    if (workflowId) {
      void openWorkflow(workflowId);
    } else {
      createNewWorkflow();
    }
    void refreshWorkflows();
    void refreshConnections();
  });

  const nodeActions = useMemo(
    () => ({
      updateNode: updateNodeConfiguration,
      deleteNode,
      runStatus,
    }),
    [updateNodeConfiguration, deleteNode, runStatus],
  );

  return (
    <div className="workflow-editor">
      <Header
        workflowName={workflowName}
        saveState={saveState}
        runState={runState}
        onBack={onBack}
        onSave={() => void saveWorkflow()}
        onExecute={() => void executeWorkflow()}
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
          connections={connections}
          workflows={workflows}
          currentWorkflowId={workflowId}
          runResult={selectedNode ? (lastRun?.nodes[selectedNode.id] ?? null) : null}
          onChange={updateNodeConfiguration}
          onDelete={deleteNode}
          onManageConnections={() => setIsConnectionManagerOpen(true)}
        />
      </div>
      <StatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        selectedNodeName={selectedNode?.data.name ?? null}
        apiStatus={apiStatus}
        saveState={saveState}
        isDirty={isDirty}
        runState={runState}
      />
      {isConnectionManagerOpen && (
        <ConnectionManager
          connections={connections}
          onClose={() => setIsConnectionManagerOpen(false)}
          onCreate={(input) => createConnection(input)}
          onUpdate={(id, patch) => updateConnection(id, patch)}
          onDelete={(id) => deleteConnection(id)}
        />
      )}
    </div>
  );
}
