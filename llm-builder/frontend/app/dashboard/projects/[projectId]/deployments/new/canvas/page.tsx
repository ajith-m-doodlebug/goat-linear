"use client";

import { useParams } from "next/navigation";
import { DeploymentCanvasWorkspace } from "../../components/DeploymentCanvasWorkspace";

export default function NewDeploymentCanvasPage() {
  const params = useParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  if (!projectId) return null;
  return <DeploymentCanvasWorkspace projectId={projectId} deploymentId={null} />;
}
