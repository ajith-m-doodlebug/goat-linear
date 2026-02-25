"""Training job worker. Runs fine-tuning (stub: updates status and optionally registers a model)."""
import os
import uuid
from app.db.base import SessionLocal
from app.models.training import TrainingJob, TrainingJobStatus
from app.models.model_registry import ModelRegistry
from app.models.training import TrainingDataset


def run_training(job_id: str) -> None:
    """
    Run training job. Full PEFT/LoRA would require transformers, peft, etc.
    This stub marks the job as running then completed and creates a placeholder
    fine-tuned model record linked to the base model.
    """
    db = SessionLocal()
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job or job.status not in (TrainingJobStatus.QUEUED.value, TrainingJobStatus.FAILED.value):
            return
        job.status = TrainingJobStatus.RUNNING.value
        job.error_message = None
        db.commit()

        base = db.query(ModelRegistry).filter(ModelRegistry.id == job.base_model_id).first()
        dataset = db.query(TrainingDataset).filter(TrainingDataset.id == job.dataset_id).first()
        if not base or not dataset:
            job.status = TrainingJobStatus.FAILED.value
            job.error_message = "Base model or dataset not found"
            db.commit()
            return

        # Stub: in production, run actual training (e.g. PEFT/LoRA), save adapter, then register.
        # Here we create a new model registry entry as "fine_tuned" linked to base.
        result_model = ModelRegistry(
            id=str(uuid.uuid4()),
            name=f"{base.name}-finetuned-{job_id[:8]}",
            model_type="fine_tuned",
            provider=base.provider,
            endpoint_url=base.endpoint_url,
            model_id=base.model_id,
            api_key_encrypted=base.api_key_encrypted,
            config=base.config,
            version="1.0",
            base_model_id=base.id,
            training_metadata={"job_id": job_id, "dataset_id": job.dataset_id, "config": job.config},
        )
        db.add(result_model)
        db.flush()
        job.status = TrainingJobStatus.COMPLETED.value
        job.result_model_id = result_model.id
        job.metrics = {"loss": 0.5, "steps": 100}
        db.commit()
    except Exception as e:
        if db:
            job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if job:
                job.status = TrainingJobStatus.FAILED.value
                job.error_message = str(e)[:2000]
            db.commit()
        raise
    finally:
        db.close()
