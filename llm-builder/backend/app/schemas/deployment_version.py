"""Schemas for deployment versions (hosted API)."""
from pydantic import BaseModel
from typing import Any


class DeployRequest(BaseModel):
    """Body for POST /deployments/{id}/deploy (first-time deploy)."""
    memory_enabled: bool = False
    memory_turns: int = 10


class HostConfig(BaseModel):
    """Optional host config stored with a version."""
    port: int | None = None
    memory_enabled: bool = False
    memory_turns: int = 10


class DeploymentVersionResponse(BaseModel):
    id: str
    deployment_id: str
    version_label: str
    status: str
    memory_enabled: bool = False
    created_at: str
    started_at: str | None = None
    stopped_at: str | None = None

    class Config:
        from_attributes = True


class DeployResponse(BaseModel):
    """Response after creating first version (Deploy) or new version."""
    version_id: str
    version_label: str
    endpoint_url: str
    status: str
