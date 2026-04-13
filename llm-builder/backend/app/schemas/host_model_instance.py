from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


HostModelStatus = Literal["creating", "starting", "healthy", "error", "stopping", "stopped"]
# API only creates local_path; "hf_repo" may still appear on old rows until deleted.
HostModelSource = Literal["local_path", "hf_repo"]


class HostModelInstanceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    model_ref: str
    served_model_name: str
    gpu_ids: str = "0"
    tensor_parallel_size: int = Field(default=1, ge=1, le=16)
    port: int = Field(ge=1025, le=65535)
    api_key: str | None = None
    config: dict[str, Any] | None = None
    autostart: bool = True


class HostModelInstanceUpdate(BaseModel):
    name: str | None = None
    gpu_ids: str | None = None
    tensor_parallel_size: int | None = Field(default=None, ge=1, le=16)
    api_key: str | None = None
    config: dict[str, Any] | None = None


class HostModelInstanceResponse(BaseModel):
    id: str
    name: str
    engine: str
    model_source: HostModelSource
    model_ref: str
    served_model_name: str
    gpu_ids: str
    tensor_parallel_size: int
    port: int
    base_url: str
    status: HostModelStatus
    health_message: str | None = None
    container_id: str | None = None
    last_log_excerpt: str | None = None
    config: dict[str, Any] | None = None
    created_by: str | None = None
    created_at: str


class HostModelRegisterRequest(BaseModel):
    name: str | None = None


class HostModelRegisterResponse(BaseModel):
    model_id: str
    name: str
    provider: str
    endpoint_url: str
    model_ref: str
