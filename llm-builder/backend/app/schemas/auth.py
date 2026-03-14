from pydantic import BaseModel, EmailStr

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RequestOtpRequest(BaseModel):
    email: EmailStr


class RegisterWithOtpRequest(BaseModel):
    email: EmailStr
    otp: str
    password: str
    full_name: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str
    type: str
    exp: int


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
