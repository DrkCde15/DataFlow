import { useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WorkflowEditorPage } from './pages/WorkflowEditorPage';

export type Route =
  | { name: 'home' }
  | { name: 'editor'; workflowId: string | null };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (route.name === 'home') {
    return (
      <HomePage
        onOpenWorkflow={(id) => setRoute({ name: 'editor', workflowId: id })}
        onCreateWorkflow={() => setRoute({ name: 'editor', workflowId: null })}
      />
    );
  }

  return (
    <WorkflowEditorPage
      key={route.workflowId ?? 'new'}
      workflowId={route.workflowId}
      onBack={() => setRoute({ name: 'home' })}
    />
  );
}
