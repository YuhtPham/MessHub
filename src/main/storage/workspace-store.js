const path = require('path');
const { ensureDirectory, readJson, writeJson } = require('./json-store');

const EMPTY_WORKSPACE_DATA = { profiles: [], quickReplies: [] };

function normalizeWorkspaceData(data = {}) {
  return {
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
  };
}

class WorkspaceStore {
  constructor(userDataPath, getSettings, saveSettings) {
    this.directory = path.join(userDataPath, 'workspaces');
    this.indexPath = path.join(this.directory, 'index.json');
    this.getSettings = getSettings;
    this.saveSettings = saveSettings;
  }

  loadIndex() {
    ensureDirectory(this.directory);
    let index = readJson(this.indexPath, { currentId: 'default', workspaces: [] });

    if (!Array.isArray(index.workspaces) || index.workspaces.length === 0) {
      index = {
        currentId: 'default',
        workspaces: [{ id: 'default', name: 'Workspace mặc định', createdAt: Date.now() }],
      };
      writeJson(this.indexPath, index);
    }

    if (!index.workspaces.some((workspace) => workspace.id === index.currentId)) {
      index.currentId = index.workspaces[0].id;
    }

    return index;
  }

  getDataPath(id) {
    return path.join(this.directory, id, 'data.json');
  }

  loadData(id) {
    return normalizeWorkspaceData(readJson(this.getDataPath(id), EMPTY_WORKSPACE_DATA));
  }

  saveData(id, data) {
    writeJson(this.getDataPath(id), normalizeWorkspaceData(data));
  }

  getState() {
    const index = this.loadIndex();
    const data = this.loadData(index.currentId);
    const legacyReplies = this.getSettings().quickReplies;

    if (data.quickReplies.length === 0 && legacyReplies?.length) {
      data.quickReplies = legacyReplies;
    }

    return { ...index, data };
  }

  saveCurrentData(data) {
    const index = this.loadIndex();
    const normalizedData = normalizeWorkspaceData(data);
    this.saveData(index.currentId, normalizedData);
    this.getSettings().quickReplies = normalizedData.quickReplies;
    this.saveSettings();
    return this.getState();
  }

  create(name) {
    const index = this.loadIndex();
    const id = `ws_${Date.now()}`;
    index.workspaces.push({
      id,
      name: String(name || 'Workspace mới').trim() || 'Workspace mới',
      createdAt: Date.now(),
    });
    index.currentId = id;
    writeJson(this.indexPath, index);
    this.saveData(id, EMPTY_WORKSPACE_DATA);
    return this.getState();
  }

  switchTo(id) {
    const index = this.loadIndex();
    if (index.workspaces.some((workspace) => workspace.id === id)) {
      index.currentId = id;
      writeJson(this.indexPath, index);
    }
    return this.getState();
  }
}

module.exports = { WorkspaceStore };
