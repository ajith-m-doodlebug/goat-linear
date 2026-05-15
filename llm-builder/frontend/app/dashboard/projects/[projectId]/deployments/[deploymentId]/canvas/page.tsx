"use client";

import { useParams } from "next/navigation";
import { DeploymentCanvasWorkspace } from "../../components/DeploymentCanvasWorkspace";

export default function DeploymentCanvasPage() {
  const params = useParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const deploymentId = typeof params.deploymentId === "string" ? params.deploymentId : "";
  if (!projectId || !deploymentId) return null;
  return <DeploymentCanvasWorkspace projectId={projectId} deploymentId={deploymentId} />;
}
