from typing import Any

from pydantic import BaseModel, Field

JsonNode = dict[str, Any]


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    nodes: list[JsonNode] = Field(default_factory=list)
    edges: list[JsonNode] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    nodes: list[JsonNode] | None = None
    edges: list[JsonNode] | None = None


class WorkflowRecord(BaseModel):
    id: str
    name: str
    nodes: list[JsonNode]
    edges: list[JsonNode]
    created_at: str
    updated_at: str


class WorkflowSummary(BaseModel):
    id: str
    name: str
    node_count: int
    edge_count: int
    created_at: str
    updated_at: str


class HealthStatus(BaseModel):
    status: str


class ConnectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: str = Field(min_length=1, max_length=50)
    connection_string: str = Field(min_length=1, max_length=2000)


class ConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    type: str | None = Field(default=None, min_length=1, max_length=50)
    connection_string: str | None = Field(
        default=None, min_length=1, max_length=2000
    )


class ConnectionSummary(BaseModel):
    id: str
    name: str
    type: str
    created_at: str
    updated_at: str


class MigrationDetail(BaseModel):
    workflow_id: str
    workflow_name: str
    node_id: str
    node_name: str
    node_type: str
    action: str
    connection_id: str | None
    connection_name: str


class MigrationReport(BaseModel):
    migrated: bool
    created_connections: int
    updated_workflows: int
    cleaned_nodes: int
    details: list[MigrationDetail]
