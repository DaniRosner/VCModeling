(function () {
  const FILE_MIME = "application/json";
  const DEFAULT_FILE_NAME = "vc-model-data.json";
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const fileIdKey = "maccabee-fund-ii-drive-file-id-v1";
  const fileNameKey = "maccabee-fund-ii-drive-file-name-v1";
  const lastModifiedKey = "maccabee-fund-ii-drive-last-modified-v1";

  let accessToken = null;
  let tokenClient = null;
  let pickerLoaded = false;

  function config() {
    return window.DRIVE_CONFIG || {};
  }

  function isConfigured() {
    const cfg = config();
    return Boolean(cfg.clientId && cfg.apiKey);
  }

  function gisAvailable() {
    return typeof window.google !== "undefined" && Boolean(window.google.accounts?.oauth2);
  }

  function isSupported() {
    return isConfigured() && gisAvailable();
  }

  function ensureTokenClient() {
    if (tokenClient) return tokenClient;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: config().clientId,
      scope: SCOPE,
      callback: () => {}
    });
    return tokenClient;
  }

  function requestToken(promptMode) {
    return new Promise((resolve, reject) => {
      if (!isSupported()) {
        reject(new Error("Drive sync is not configured or Google's sign-in library failed to load."));
        return;
      }
      const client = ensureTokenClient();
      client.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        resolve(accessToken);
      };
      client.error_callback = (error) => reject(new Error(error?.type || "Sign-in was cancelled or failed."));
      client.requestAccessToken({ prompt: promptMode });
    });
  }

  function connect() {
    return requestToken("consent");
  }

  function silentReconnect() {
    if (!isSupported()) return Promise.resolve(null);
    return requestToken("").catch(() => null);
  }

  async function ensureAccessToken() {
    if (accessToken) return accessToken;
    return connect();
  }

  function authHeaders() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  function getFileId() {
    return localStorage.getItem(fileIdKey) || null;
  }

  function setFileId(id, name) {
    if (id) {
      localStorage.setItem(fileIdKey, id);
      if (name) localStorage.setItem(fileNameKey, name);
    } else {
      localStorage.removeItem(fileIdKey);
      localStorage.removeItem(fileNameKey);
    }
  }

  function getFileName() {
    return localStorage.getItem(fileNameKey) || null;
  }

  function getLastSyncedModifiedTime() {
    return localStorage.getItem(lastModifiedKey) || null;
  }

  function setLastSyncedModifiedTime(value) {
    if (value) localStorage.setItem(lastModifiedKey, value);
    else localStorage.removeItem(lastModifiedKey);
  }

  function forgetFile() {
    setFileId(null);
    setLastSyncedModifiedTime(null);
  }

  function disconnect() {
    if (accessToken && window.google?.accounts?.oauth2?.revoke) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
  }

  async function loadPicker() {
    if (pickerLoaded) return;
    if (typeof window.gapi === "undefined") {
      throw new Error("Google API loader (gapi) is not available yet - try again in a moment.");
    }
    await new Promise((resolve, reject) => {
      gapi.load("picker", { callback: resolve, onerror: reject });
    });
    pickerLoaded = true;
  }

  async function driveFetch(url, options = {}) {
    await ensureAccessToken();
    const response = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Drive request failed (${response.status}): ${body || response.statusText}`);
    }
    return response;
  }

  async function createFile(snapshot, name = DEFAULT_FILE_NAME) {
    const createResponse = await driveFetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FILE_MIME })
    });
    const file = await createResponse.json();
    setFileId(file.id, name);
    const written = await writeContent(file.id, snapshot);
    return { fileId: file.id, name, modifiedTime: written.modifiedTime };
  }

  async function pickExistingFile() {
    await ensureAccessToken();
    await loadPicker();
    return new Promise((resolve, reject) => {
      try {
        const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setMimeTypes(FILE_MIME)
          .setIncludeFolders(true);
        const picker = new google.picker.PickerBuilder()
          .setOAuthToken(accessToken)
          .setDeveloperKey(config().apiKey)
          .addView(view)
          .setCallback((data) => {
            if (data.action === google.picker.Action.PICKED) {
              const doc = data.docs[0];
              setFileId(doc.id, doc.name);
              setLastSyncedModifiedTime(null);
              resolve({ fileId: doc.id, name: doc.name });
            } else if (data.action === google.picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();
        picker.setVisible(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function getMetadata(fileId) {
    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime`
    );
    return response.json();
  }

  async function readContent(fileId) {
    const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return response.json();
  }

  async function writeContent(fileId, snapshot) {
    const response = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot)
      }
    );
    return response.json();
  }

  async function pull() {
    const fileId = getFileId();
    if (!fileId) return null;
    const [meta, data] = await Promise.all([getMetadata(fileId), readContent(fileId)]);
    setLastSyncedModifiedTime(meta.modifiedTime);
    setFileId(fileId, meta.name);
    return { data, modifiedTime: meta.modifiedTime, fileName: meta.name };
  }

  async function push(snapshot, { force = false } = {}) {
    const fileId = getFileId();
    if (!fileId) return { ok: false, reason: "no-file" };
    if (!force) {
      const lastSynced = getLastSyncedModifiedTime();
      if (lastSynced) {
        const meta = await getMetadata(fileId);
        if (meta.modifiedTime !== lastSynced) {
          return { ok: false, reason: "conflict", remoteModifiedTime: meta.modifiedTime };
        }
      }
    }
    const file = await writeContent(fileId, snapshot);
    setLastSyncedModifiedTime(file.modifiedTime);
    return { ok: true, modifiedTime: file.modifiedTime };
  }

  function getStatus() {
    return {
      configured: isConfigured(),
      supported: isSupported(),
      connected: Boolean(accessToken),
      fileId: getFileId(),
      fileName: getFileName(),
      lastSyncedModifiedTime: getLastSyncedModifiedTime()
    };
  }

  window.DriveSync = {
    isConfigured,
    isSupported,
    connect,
    silentReconnect,
    disconnect,
    hasFile: () => Boolean(getFileId()),
    getFileId,
    forgetFile,
    createFile,
    pickExistingFile,
    pull,
    push,
    getStatus
  };
})();
