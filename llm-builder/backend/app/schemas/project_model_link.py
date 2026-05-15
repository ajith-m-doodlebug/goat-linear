from pydantic import BaseModel


class ProjectModelLinkCreate(BaseModel):
    model_id: str
