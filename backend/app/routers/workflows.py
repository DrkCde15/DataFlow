from fastapi import APIRouter, HTTPException

from .. import repository
from ..models import WorkflowCreate, WorkflowRecord, WorkflowSummary, WorkflowUpdate

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowSummary])
def list_workflows() -> list[WorkflowSummary]:
    return repository.list_workflows()


@router.post("", response_model=WorkflowRecord, status_code=201)
def create_workflow(payload: WorkflowCreate) -> WorkflowRecord:
    return repository.create_workflow(payload.name, payload.nodes, payload.edges)


@router.get("/{workflow_id}", response_model=WorkflowRecord)
def get_workflow(workflow_id: str) -> WorkflowRecord:
    workflow = repository.get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowRecord)
def update_workflow(workflow_id: str, payload: WorkflowUpdate) -> WorkflowRecord:
    workflow = repository.update_workflow(
        workflow_id, payload.name, payload.nodes, payload.edges
    )
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str) -> None:
    if not repository.delete_workflow(workflow_id):
        raise HTTPException(status_code=404, detail="Workflow not found")
