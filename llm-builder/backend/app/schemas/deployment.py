from pydantic import BaseModel
from typing import Any


class DeploymentBase(BaseModel):
    name: str
    model_id: str
    knowledge_base_id: str | None = None
    prompt_template_id: str | None = None
    memory_turns: str | None = None
    config: dict[str, Any] | None = None
    version: str | None = None


class DeploymentCreate(DeploymentBase):
    pass


class DeploymentUpdate(BaseModel):
    name: str | None = None
    model_id: str | None = None
    knowledge_base_id: str | None = None
    prompt_template_id: str | None = None
    memory_turns: str | None = None
    config: dict[str, Any] | None = None
    version: str | None = None


class DeploymentResponse(DeploymentBase):
    id: str
    created_at: str

    class Config:
        from_attributes = True
