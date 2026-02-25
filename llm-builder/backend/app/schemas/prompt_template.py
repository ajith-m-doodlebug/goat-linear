from pydantic import BaseModel


class PromptTemplateBase(BaseModel):
    name: str
    content: str
    version: str | None = None


class PromptTemplateCreate(PromptTemplateBase):
    pass


class PromptTemplateUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    version: str | None = None


class PromptTemplateResponse(PromptTemplateBase):
    id: str
    created_at: str

    class Config:
        from_attributes = True
