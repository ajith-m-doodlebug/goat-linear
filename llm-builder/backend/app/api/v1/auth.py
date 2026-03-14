import logging
import uuid
import random
from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User, Role
from app.models.system_settings import SystemSettings
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterResponse,
    RegisterWithOtpRequest,
    RequestOtpRequest,
    Token,
)
from app.schemas.user import UserResponse
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.deps import get_current_user
from app.core.queue import get_redis
from app.services.email import send_email, is_email_configured

router = APIRouter()

OTP_TTL_SECONDS = 600  # 10 minutes
OTP_KEY_PREFIX = "otp:"


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
        default_model_id=user.default_model_id,
        default_prompt_id=user.default_prompt_id,
    )


def _get_allowed_domain(db: Session) -> str | None:
    row = db.query(SystemSettings).first()
    if not row:
        return None
    return (row.allowed_email_domain or "").strip().lower()


@router.post("/request-otp")
def request_otp(body: RequestOtpRequest, db: Session = Depends(get_db)):
    if not is_email_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email is not configured. Contact your administrator.",
        )
    domain = _get_allowed_domain(db)
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Setup not completed",
        )
    email = body.email.lower().strip()
    if "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email")
    email_domain = email.split("@", 1)[1].lower()
    if email_domain != domain:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Registration is restricted to @{domain}",
        )
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    otp = str(random.randint(100000, 999999))
    logger.info("OTP for %s: %s (expires in %s min)", email, otp, OTP_TTL_SECONDS // 60)
    redis = get_redis()
    redis.setex(f"{OTP_KEY_PREFIX}{email}", OTP_TTL_SECONDS, otp)
    try:
        send_email(
            to=email,
            subject="Your verification code",
            body_plain=f"Your verification code is: {otp}\n\nIt expires in 10 minutes.",
        )
    except Exception as e:
        redis.delete(f"{OTP_KEY_PREFIX}{email}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send email",
        ) from e
    return {"message": "OTP sent"}


@router.post("/register", response_model=RegisterResponse)
def register(body: RegisterWithOtpRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    redis = get_redis()
    key = f"{OTP_KEY_PREFIX}{email}"
    stored = redis.get(key)
    if not stored or stored.decode() != body.otp.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
    redis.delete(key)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    settings = db.query(SystemSettings).first()
    default_model_id = settings.default_model_id if settings else None
    default_prompt_id = settings.default_prompt_id if settings else None
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=get_password_hash(body.password),
        full_name=body.full_name,
        role=Role.DEVELOPER,
        is_active=True,
        default_model_id=default_model_id,
        default_prompt_id=default_prompt_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return RegisterResponse(
        user=_user_to_response(user),
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
    )


@router.post("/login", response_model=Token)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=Token)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return _user_to_response(user)
