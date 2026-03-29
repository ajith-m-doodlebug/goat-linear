from app.models.user import Role
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: Role = Role.ADMIN
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserCreateBySuperAdmin(BaseModel):
    """Create a user from the Users admin UI (super admin only)."""

    email: EmailStr
    password: str
    role: Role


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = None
    default_model_id: str | None = None
    default_prompt_id: str | None = None


class UserResponse(UserBase):
    id: str
    created_at: str
    default_model_id: str | None = None
    default_prompt_id: str | None = None

    class Config:
        from_attributes = True
