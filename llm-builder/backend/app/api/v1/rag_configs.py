import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.rag_config_preset import RagConfigPreset
from app.core.deps import get_current_user
from app.schemas.rag_config import RagConfigPresetCreate, RagConfigPresetUpdate, RagConfigPresetResponse

router = APIRouter()


def _config_to_dict(c) -> dict:
    if c is None:
        return {}
    if isinstance(c, dict):
        return c
    if hasattr(c, "model_dump"):
        return c.model_dump(exclude_none=True)
    return {}


@router.get("", response_model=list[RagConfigPresetResponse])
def list_rag_configs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    presets = db.query(RagConfigPreset).filter(RagConfigPreset.user_id == user.id).order_by(RagConfigPreset.updated_at.desc()).all()
    return [
        RagConfigPresetResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            config=p.config or {},
            created_at=p.created_at.isoformat() if p.created_at else "",
        )
        for p in presets
    ]


@router.post("", response_model=RagConfigPresetResponse)
def create_rag_config(
    body: RagConfigPresetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    config = _config_to_dict(body.config)
    preset = RagConfigPreset(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=body.name.strip(),
        description=(body.description or "").strip() or None,
        config=config,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return RagConfigPresetResponse(
        id=preset.id,
        name=preset.name,
        description=preset.description,
        config=preset.config or {},
        created_at=preset.created_at.isoformat() if preset.created_at else "",
    )


@router.get("/{preset_id}", response_model=RagConfigPresetResponse)
def get_rag_config(
    preset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    preset = db.query(RagConfigPreset).filter(RagConfigPreset.id == preset_id, RagConfigPreset.user_id == user.id).first()
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    return RagConfigPresetResponse(
        id=preset.id,
        name=preset.name,
        description=preset.description,
        config=preset.config or {},
        created_at=preset.created_at.isoformat() if preset.created_at else "",
    )


@router.patch("/{preset_id}", response_model=RagConfigPresetResponse)
def update_rag_config(
    preset_id: str,
    body: RagConfigPresetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    preset = db.query(RagConfigPreset).filter(RagConfigPreset.id == preset_id, RagConfigPreset.user_id == user.id).first()
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    if body.name is not None:
        preset.name = body.name.strip()
    if body.description is not None:
        preset.description = body.description.strip() or None
    if body.config is not None:
        preset.config = _config_to_dict(body.config)
    db.commit()
    db.refresh(preset)
    return RagConfigPresetResponse(
        id=preset.id,
        name=preset.name,
        description=preset.description,
        config=preset.config or {},
        created_at=preset.created_at.isoformat() if preset.created_at else "",
    )


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rag_config(
    preset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    preset = db.query(RagConfigPreset).filter(RagConfigPreset.id == preset_id, RagConfigPreset.user_id == user.id).first()
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    db.delete(preset)
    db.commit()
