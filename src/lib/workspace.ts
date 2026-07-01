/**
 * Derive a human-friendly workspace name from its file path. One IDE window =
 * one workspace, so this is shown in the header and the OS window title.
 */
export function workspaceDisplayName(
  workspacePath: string | null,
  fallback = 'Untitled Workspace',
): string {
  if (!workspacePath) return fallback
  const base = workspacePath.split(/[\\/]/).pop() ?? workspacePath
  return base.replace(/\.langstitch\.json$/i, '').replace(/\.json$/i, '') || fallback
}
