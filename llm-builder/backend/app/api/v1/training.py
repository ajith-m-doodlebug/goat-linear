import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.training import TrainingDataset, TrainingJob, TrainingJobStatus
from app.core.deps import get_current_user, require_builder
from app.core.config import get_settings
from app.core.queue import get_queue
from app.workers.training import run_training

router = APIRouter()

TRAINING_DATASETS_DIR = "training_datasets"


@router.get("/datasets")
def list_datasets(db: Session = Depends(get_db), _: User = Depends(require_builder)):
    datasets = db.query(TrainingDataset).all()
    return [
        {"id": d.id, "name": d.name, "format": d.format, "row_count": d.row_count, "created_at": d.created_at.isoformat() if d.created_at else ""}
        for d in datasets
    ]


@router.post("/datasets")
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(""),
    db: Session = Depends(get_db),
    _: User = Depends(require_builder),
):
    settings = get_settings()
    base_dir = os.path.join(settings.upload_dir, TRAINING_DATASETS_DIR)
    os.makedirs(base_dir, exist_ok=True)
    dataset_id = str(uuid.uuid4())
    ext = ".jsonl" if (file.filename or "").endswith(".jsonl") else ".json"
    path = os.path.join(dataset_id + ext)
    full_path = os.path.join(base_dir, path)
    content = await file.read()
    with open(full_path, "wb") as f:
        f.write(content)
    row_count = str(max(0, content.count(b"\n")))
    ds = TrainingDataset(
        id=dataset_id,
        name=name or (file.filename or "dataset"),
        storage_path=os.path.join(TRAINING_DATASETS_DIR, path),
        format="jsonl" if ext == ".jsonl" else "json",
        row_count=row_count,
    )
    db.add(ds)
    db.commit()
    return {"id": ds.id, "name": ds.name, "format": ds.format, "row_count": row_count}


@router.get("/jobs")
def list_jobs(db: Session = Depends(get_db), _: User = Depends(require_builder)):
    jobs = db.query(TrainingJob).order_by(TrainingJob.created_at.desc()).limit(100).all()
    return [
        {
            "id": j.id,
            "dataset_id": j.dataset_id,
            "base_model_id": j.base_model_id,
            "status": j.status,
            "error_message": j.error_message,
            "result_model_id": j.result_model_id,
            "metrics": j.metrics,
            "created_at": j.created_at.isoformat() if j.created_at else "",
            "updated_at": j.updated_at.isoformat() if j.updated_at else "",
        }
        for j in jobs
    ]


@router.post("/jobs")
def create_job(
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_builder),
):
    dataset_id = body.get("dataset_id")
    base_model_id = body.get("base_model_id")
    if not dataset_id or not base_model_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="dataset_id and base_model_id required")
    ds = db.query(TrainingDataset).filter(TrainingDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    from app.models.model_registry import ModelRegistry
    model = db.query(ModelRegistry).filter(ModelRegistry.id == base_model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Base model not found")
    job = TrainingJob(
        id=str(uuid.uuid4()),
        dataset_id=dataset_id,
        base_model_id=base_model_id,
        status=TrainingJobStatus.QUEUED.value,
        config=body.get("config"),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    queue = get_queue()
    queue.enqueue(run_training, job.id, job_timeout="1h")
    return {
        "id": job.id,
        "dataset_id": job.dataset_id,
        "base_model_id": job.base_model_id,
        "status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else "",
    }


@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db), _: User = Depends(require_builder)):
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {
        "id": job.id,
        "dataset_id": job.dataset_id,
        "base_model_id": job.base_model_id,
        "status": job.status,
        "config": job.config,
        "error_message": job.error_message,
        "result_model_id": job.result_model_id,
        "metrics": job.metrics,
        "created_at": job.created_at.isoformat() if job.created_at else "",
        "updated_at": job.updated_at.isoformat() if job.updated_at else "",
    }
