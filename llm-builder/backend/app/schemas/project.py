from pydantic import BaseModel, EmailStr, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    owner_user_id: str
    cloned_from_project_id: str | None
    created_at: str

    class Config:
        from_attributes = True


class ProjectMemberResponse(BaseModel):
    user_id: str
    email: str
    access: str


class ProjectMemberInvite(BaseModel):
    email: EmailStr
    access: str = "view"  # "view" | "edit"


class ProjectMemberUpdateAccess(BaseModel):
    access: str  # "view" | "edit"


class ProjectCloneRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
