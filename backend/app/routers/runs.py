from fastapi import APIRouter, HTTPException

from .. import repository
from ..database import utc_now
from ..executor import engine
from ..models import WorkflowRun

router = APIRouter(tags=["runs"])


@router.post(
    "/api/workflows/{workflow_id}/run",
    response_model=WorkflowRun,
    status_code=201,
)
def run_workflow(workflow_id: str) -> WorkflowRun:
    workflow = repository.get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    started_at = utc_now()
    result = engine.run_workflow(workflow["nodes"], workflow["edges"])
    finished_at = utc_now()

    return repository.create_run(
        workflow_id, result["status"], started_at, finished_at, result
    )


@router.get(
    "/api/workflows/{workflow_id}/runs",
    response_model=list[WorkflowRun],
)
def list_runs(workflow_id: str) -> list[WorkflowRun]:
    if repository.get_workflow(workflow_id) is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return repository.list_runs(workflow_id)


@router.get("/api/runs/{run_id}", response_model=WorkflowRun)
def get_run(run_id: str) -> WorkflowRun:
    run = repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
