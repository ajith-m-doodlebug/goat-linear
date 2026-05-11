"""Create payloads for API / database knowledge documents."""
from pydantic import BaseModel, Field


class DocumentApiCreate(BaseModel):
    name: str = Field(..., max_length=512)
    method: str = "GET"  # GET, POST, PUT, PATCH, DELETE
    url: str
    headers: dict[str, str] | None = None
    body: str | None = None  # JSON string or raw body template
    example_response: str | None = None
    execute_at_runtime: bool = True


class DocumentDatabaseCreate(BaseModel):
    name: str = Field(..., max_length=512)
    engine: str  # postgresql, mysql, sqlite
    host: str | None = None
    port: int | None = None
    database: str | None = None
    user: str | None = None
    password: str | None = None  # plain at create; stored encrypted
    sqlite_path: str | None = None  # for sqlite engine
    default_schema: str | None = None
