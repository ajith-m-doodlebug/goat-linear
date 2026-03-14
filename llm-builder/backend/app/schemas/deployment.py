from pydantic import BaseModel


class DeploymentBase(BaseModel):
    name: str
    model_id: str
    knowledge_base_id: str | None = None
    prompt_template_id: str | None = None
    is_hosted: bool = False
    live_version: str | None = None


class DeploymentCreate(DeploymentBase):
    pass


class DeploymentUpdate(BaseModel):
    name: str | None = None
    model_id: str | None = None
    knowledge_base_id: str | None = None
    prompt_template_id: str | None = None
    is_hosted: bool | None = None
    live_version: str | None = None


class DeploymentResponse(DeploymentBase):
    id: str
    created_at: str
    has_hosted_versions: bool | None = None  # set by list endpoint when listing deployments
    hosted_status: str | None = None  # "live" | "stopped" | None (not deployed)

    class Config:
        from_attributes = True
