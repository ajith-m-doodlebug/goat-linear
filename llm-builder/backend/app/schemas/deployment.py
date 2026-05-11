from pydantic import BaseModel, model_validator


class DeploymentBase(BaseModel):
    name: str
    model_id: str
    knowledge_base_id: str | None = None
    intent_mapper_id: str | None = None
    prompt_template_id: str | None = None
    is_hosted: bool = False
    live_version: str | None = None

    @model_validator(mode="after")
    def kb_or_intent_not_both(self):
        kb = self.knowledge_base_id
        im = self.intent_mapper_id
        if kb and im:
            raise ValueError("Specify only one of knowledge_base_id or intent_mapper_id")
        return self


class DeploymentCreate(DeploymentBase):
    pass


class DeploymentUpdate(BaseModel):
    name: str | None = None
    model_id: str | None = None
    knowledge_base_id: str | None = None
    intent_mapper_id: str | None = None
    prompt_template_id: str | None = None
    is_hosted: bool | None = None
    live_version: str | None = None

    @model_validator(mode="after")
    def kb_or_intent_not_both(self):
        kb = self.knowledge_base_id
        im = self.intent_mapper_id
        if kb is not None and im is not None and kb and im:
            raise ValueError("Specify only one of knowledge_base_id or intent_mapper_id")
        return self


class DeploymentResponse(DeploymentBase):
    id: str
    created_at: str
    has_hosted_versions: bool | None = None  # set by list endpoint when listing deployments
    hosted_status: str | None = None  # "live" | "stopped" | None (not deployed)

    class Config:
        from_attributes = True
