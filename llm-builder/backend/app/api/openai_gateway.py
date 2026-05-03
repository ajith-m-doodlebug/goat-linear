"""OpenAI-compatible routes on the API port: multiplex hosted models via JSON `model` (served_model_name)."""

import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.db.base import get_db
from app.models.host_model_instance import HostModelInstance
from app.services.vllm_hosting import inference_internal_http_origin

router = APIRouter(prefix="/v1", tags=["openai-gateway"])

_HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
    }
)


def _forward_headers(request: Request) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in request.headers.items():
        lk = k.lower()
        if lk == "host":
            continue
        if lk in _HOP_BY_HOP:
            continue
        out[k] = v
    return out


@router.get("/models")
async def openai_list_models(db: Session = Depends(get_db)):
    rows = (
        db.query(HostModelInstance)
        .filter(HostModelInstance.status == "healthy")
        .order_by(HostModelInstance.served_model_name.asc())
        .all()
    )
    data = [
        {
            "id": r.served_model_name,
            "object": "model",
            "owned_by": "ragline",
            "created": int(r.created_at.timestamp()) if r.created_at else 0,
        }
        for r in rows
    ]
    return {"object": "list", "data": data}


@router.post("/chat/completions")
async def openai_chat_completions(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON body: {e}") from e

    model_id = (payload.get("model") or "").strip()
    if not model_id:
        raise HTTPException(status_code=400, detail="Missing required field: model")

    inst = (
        db.query(HostModelInstance)
        .filter(HostModelInstance.served_model_name == model_id)
        .first()
    )
    if not inst:
        raise HTTPException(status_code=404, detail=f"No hosted model '{model_id}'")
    if inst.status != "healthy":
        raise HTTPException(
            status_code=503,
            detail=f"Model '{model_id}' is not ready (status={inst.status})",
        )

    upstream = inference_internal_http_origin(inst).rstrip("/") + "/v1/chat/completions"
    fwd_headers = _forward_headers(request)
    stream_requested = payload.get("stream") is True

    timeout = httpx.Timeout(connect=60.0, read=None, write=300.0, pool=60.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        upstream_req = client.build_request(
            "POST",
            upstream,
            headers=fwd_headers,
            content=raw,
        )
        if stream_requested:
            resp = await client.send(upstream_req, stream=True)
            if resp.status_code >= 400:
                err_body = await resp.aread()
                await resp.aclose()
                return Response(content=err_body, status_code=resp.status_code)

            async def stream_body():
                try:
                    async for chunk in resp.aiter_bytes():
                        yield chunk
                finally:
                    await resp.aclose()

            out_headers = {
                k: v
                for k, v in resp.headers.items()
                if k.lower() not in _HOP_BY_HOP
            }
            return StreamingResponse(
                stream_body(),
                status_code=resp.status_code,
                headers=out_headers,
            )

        resp = await client.send(upstream_req)
        out_headers = {
            k: v
            for k, v in resp.headers.items()
            if k.lower() not in _HOP_BY_HOP
        }
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=out_headers,
        )
