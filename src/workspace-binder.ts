import type { App } from "obsidian";

interface WorkspacesPluginInstance {
  activeWorkspace?: string;
  workspaces?: Record<string, unknown>;
  loadWorkspace(name: string): void | Promise<void>;
  saveWorkspace(name: string): void | Promise<void>;
  setActiveWorkspace?(name: string): void;
}

interface InternalPluginEntry {
  enabled: boolean;
  instance: WorkspacesPluginInstance;
}

export function getWorkspacesPlugin(app: App): WorkspacesPluginInstance | null {
  const internalPlugins = (app as unknown as {
    internalPlugins?: { plugins?: Record<string, InternalPluginEntry> };
  }).internalPlugins;
  const entry = internalPlugins?.plugins?.workspaces;
  if (!entry?.enabled) return null;
  const inst = entry.instance;
  if (!inst || typeof inst.loadWorkspace !== "function" || typeof inst.saveWorkspace !== "function") {
    return null;
  }
  return inst;
}

/**
 * Switch to the named workspace. Saves the current workspace first (so live
 * state isn't lost), then loads the target. If the target doesn't exist yet,
 * it's created from the current layout.
 */
export async function switchToWorkspace(app: App, name: string): Promise<void> {
  const ws = getWorkspacesPlugin(app);
  if (!ws) return;
  if (!name) return;
  if (ws.activeWorkspace === name) return;

  // Persist whatever the user has now before clobbering the layout.
  if (ws.activeWorkspace) {
    try { await ws.saveWorkspace(ws.activeWorkspace); } catch {}
  }

  const exists = !!ws.workspaces && Object.prototype.hasOwnProperty.call(ws.workspaces, name);
  if (exists) {
    await ws.loadWorkspace(name);
  } else {
    await ws.saveWorkspace(name);
    ws.setActiveWorkspace?.(name);
  }
}

/** Persist current layout into the active workspace, if one is active. */
export async function saveActiveWorkspace(app: App): Promise<void> {
  const ws = getWorkspacesPlugin(app);
  if (!ws) return;
  const name = ws.activeWorkspace;
  if (!name) return;
  await ws.saveWorkspace(name);
}

export function getActiveWorkspaceName(app: App): string | null {
  const ws = getWorkspacesPlugin(app);
  return ws?.activeWorkspace ?? null;
}

/** Names of all workspaces saved via the core Workspaces plugin. */
export function getAllWorkspaceNames(app: App): string[] {
  const ws = getWorkspacesPlugin(app);
  if (!ws?.workspaces) return [];
  return Object.keys(ws.workspaces);
}
