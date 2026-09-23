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
