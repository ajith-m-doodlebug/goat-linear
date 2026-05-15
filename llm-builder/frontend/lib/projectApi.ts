/** Build `/api/v1/projects/:projectId/...` paths for scoped APIs. */

export function projectApi(projectId: string, tail: string): string {
  const t = tail.startsWith("/") ? tail.slice(1) : tail;
  return `/api/v1/projects/${encodeURIComponent(projectId)}/${t}`;
}
