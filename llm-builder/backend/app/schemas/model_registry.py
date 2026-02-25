from pydantic import BaseModel
from typing import Any


class ModelRegistryBase(BaseModel):
    name: str
    model_type: str = "base"
    provider: str
    endpoint_url: str | None = None
    model_id: str
    api_key_encrypted: str | None = None
    config: dict[str, Any] | None = None
    version: str | None = None
    base_model_id: str | None = None


class ModelRegistryCreate(ModelRegistryBase):
    pass


class ModelRegistryUpdate(BaseModel):
    name: str | None = None
    endpoint_url: str | None = None
    model_id: str | None = None
    api_key_encrypted: str | None = None
    config: dict[str, Any] | None = None
    version: str | None = None


class ModelRegistryResponse(ModelRegistryBase):
    id: str
    training_metadata: dict | None = None
    created_at: str

    class Config:
        from_attributes = True
