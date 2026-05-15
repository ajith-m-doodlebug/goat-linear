from fastapi import APIRouter

from app.api.v1 import (
    auth,
    users,
    projects,
    project_models,
    knowledge_bases,
    models,
    deployments,
    chat,
    rag_configs,
    setup,
    host_models,
    intent_mappers,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(setup.router, prefix="/setup", tags=["setup"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(project_models.router, prefix="/projects/{project_id}", tags=["project-models"])
api_router.include_router(
    knowledge_bases.router,
    prefix="/projects/{project_id}/knowledge-bases",
    tags=["knowledge-bases"],
)
api_router.include_router(
    intent_mappers.router,
    prefix="/projects/{project_id}/intent-mappers",
    tags=["intent-mappers"],
)
api_router.include_router(
    deployments.router,
    prefix="/projects/{project_id}/deployments",
    tags=["deployments"],
)
api_router.include_router(chat.router, prefix="/projects/{project_id}/chat", tags=["chat"])
api_router.include_router(
    rag_configs.router,
    prefix="/projects/{project_id}/rag-configs",
    tags=["rag-configs"],
)
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(host_models.router, prefix="/host-models", tags=["host-models"])
