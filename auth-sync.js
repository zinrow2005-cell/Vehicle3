(() => {
  'use strict';

  const DATA_STORAGE_KEY = 'vehicleMaintenanceFuelV48';
  const SNAPSHOT_STORAGE_KEY = 'vehicleMaintenanceSnapshotsV1';
  const AUTH_SESSION_KEY = 'vehicleHubAuthSessionV1';
  const CLOUD_SETTINGS_KEY = 'vehicleHubCloudSettingsV1';
  const CLOUD_TOKEN_KEY = 'vehicleHubCloudTokenV1';
  const PASSWORD_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  const LOCAL_ACCOUNTS = {
    dad: { displayName: 'dad', avatar: 'D' },
    mom: { displayName: 'mom', avatar: 'M' }
  };
  const DEFAULT_CLOUD_SETTINGS = {
    apiUrl: '', autoSync: false, intervalMinutes: 15, remoteRevision: 0, localBaseRevision: 0,
    lastSyncAt: '', lastSyncAction: '', lastSyncMessage: '', lastPushedHash: ''
  };

  const $ = (selector) => document.querySelector(selector);
  const nowIso = () => new Date().toISOString();
  const formatTime = (value) => value ? new Date(value).toLocaleString('zh-TW', { hour12: false }) : '—';
  let currentSession = null;
  let cloudSettings = loadCloudSettings();
  let cloudToken = readCloudToken();
  let autoSyncTimer = null;
  let failedAttempts = 0;
  let blockedUntil = 0;

  async function sha256(value) {
    if (!globalThis.crypto?.subtle) throw new Error('此瀏覽器不支援安全密碼驗證，請改用最新版Chrome、Edge或Safari。');
    const bytes = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function safeJsonParse(value, fallback = null) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function loadCloudSettings() {
    const saved = safeJsonParse(localStorage.getItem(CLOUD_SETTINGS_KEY), {}) || {};
    const legacyRevision = Number(saved.revision || 0);
    const merged = { ...DEFAULT_CLOUD_SETTINGS, ...saved };
    merged.remoteRevision = Number(saved.remoteRevision ?? legacyRevision);
    merged.localBaseRevision = Number(saved.localBaseRevision ?? legacyRevision);
    delete merged.revision;
    return merged;
  }

  function saveCloudSettings() {
    localStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify(cloudSettings));
  }

  function readCloudToken() {
    const value = safeJsonParse(sessionStorage.getItem(CLOUD_TOKEN_KEY), null);
    if (!value || Number(value.expiresAt || 0) <= Date.now()) return null;
    return value;
  }

  function writeCloudToken(value) {
    cloudToken = value;
    if (value) sessionStorage.setItem(CLOUD_TOKEN_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(CLOUD_TOKEN_KEY);
  }

  function readAuthSession() {
    for (const store of [sessionStorage, localStorage]) {
      const value = safeJsonParse(store.getItem(AUTH_SESSION_KEY), null);
      if (value && LOCAL_ACCOUNTS[value.username] && Number(value.expiresAt || 0) > Date.now()) return value;
      if (value) store.removeItem(AUTH_SESSION_KEY);
    }
    return null;
  }

  function writeAuthSession(username, remember) {
    const value = {
      username,
      loginAt: nowIso(),
      expiresAt: Date.now() + (remember ? 7 * 86400000 : 12 * 3600000)
    };
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(AUTH_SESSION_KEY, JSON.stringify(value));
    return value;
  }

  function isIPadLike() {
    const ua = String(navigator.userAgent || '');
    return /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  }

  function isTouchKeyboardDevice() {
    const ua = String(navigator.userAgent || '');
    return isIPadLike() || /iPhone|iPod|Android/i.test(ua) || Number(navigator.maxTouchPoints || 0) > 0;
  }

  function prepareLoginInput(input) {
    if (!input) return;
    input.disabled = false;
    input.readOnly = false;
    input.tabIndex = 0;
    input.style.pointerEvents = 'auto';
  }

  function activateLoginInput(input, restart = false) {
    if (!input) return;
    prepareLoginInput(input);
    // iPad Safari/PWA only reliably opens the software keyboard when focus is
    // requested directly from a user gesture. If a field is already focused
    // without a keyboard, a blur+focus inside the backup button gesture resets it.
    if (restart && document.activeElement === input) input.blur();
    try { input.focus({ preventScroll: true }); } catch { input.focus(); }
  }

  function prepareLoginFields() {
    prepareLoginInput($('#loginUsername'));
    prepareLoginInput($('#loginPassword'));
  }

  function applyIPadNativeInputMode() {
    const enabled = isIPadLike();
    document.documentElement.classList.toggle('ipad-native-input', enabled);
    if (!enabled) return;
    // iPad Safari/PWA is most reliable when the field itself handles the native tap.
    // Do not call focus() from touch/click listeners on the input; that can compete
    // with Safari's own keyboard-opening gesture. Only prepare state before the tap.
    [$('#loginUsername'), $('#loginPassword'), $('#cloudPassword'), $('#appsScriptUrl')].forEach(input => {
      if (!input || input.readOnly) return;
      prepareLoginInput(input);
      const prepare = () => prepareLoginInput(input);
      input.addEventListener('pointerdown', prepare, { capture: true, passive: true });
      input.addEventListener('touchstart', prepare, { capture: true, passive: true });
    });
  }

  function showLogin() {
    $('#loginGate').hidden = false;
    $('#appShell').hidden = true;
    prepareLoginFields();
    // Do NOT autofocus on login-page load. iPad Safari can mark the field as
    // focused without opening its software keyboard, leaving later taps stuck.
    const active = document.activeElement;
    if (active === $('#loginUsername') || active === $('#loginPassword')) active.blur();
  }

  function showApplication(session) {
    currentSession = session;
    $('#loginGate').hidden = true;
    $('#appShell').hidden = false;
    $('#currentUserName').textContent = LOCAL_ACCOUNTS[session.username].displayName;
    $('#currentUserAvatar').textContent = LOCAL_ACCOUNTS[session.username].avatar;
    $('#cloudUsername').value = session.username;
    renderCloudStatus();
    startAutoSync();
  }

  async function handleLogin(event) {
    event.preventDefault();
    const error = $('#loginError');
    error.textContent = '';
    if (Date.now() < blockedUntil) {
      error.textContent = `登入嘗試過多，請等待 ${Math.ceil((blockedUntil - Date.now()) / 1000)} 秒。`;
      return;
    }
    const username = $('#loginUsername').value.trim().toLowerCase();
    const password = $('#loginPassword').value;
    const hash = await sha256(password);
    if (!LOCAL_ACCOUNTS[username] || hash !== PASSWORD_HASH) {
      failedAttempts += 1;
      if (failedAttempts >= 5) {
        blockedUntil = Date.now() + 30000;
        failedAttempts = 0;
        error.textContent = '登入失敗次數過多，已暫停30秒。';
      } else {
        error.textContent = '帳號或密碼不正確。';
      }
      return;
    }
    failedAttempts = 0;
    const session = writeAuthSession(username, $('#rememberLogin').checked);
    $('#loginPassword').value = '';
    showApplication(session);
    addSyncLog(`${username} 已登入本機系統。`);
  }

  function logout() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    writeCloudToken(null);
    currentSession = null;
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    location.reload();
  }

  function normalizeApiUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url)) {
      throw new Error('請填入Apps Script正式部署的 /exec 網址。');
    }
    return url;
  }

  async function cloudRequest(payload) {
    const url = normalizeApiUrl(cloudSettings.apiUrl);
    if (!url) throw new Error('尚未設定Apps Script網址。');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`雲端服務HTTP ${response.status}`);
    const text = await response.text();
    const result = safeJsonParse(text, null);
    if (!result) throw new Error('Apps Script回傳格式不是有效JSON。');
    if (!result.ok) throw new Error(result.message || '雲端操作失敗。');
    return result;
  }

  function addSyncLog(message, kind = 'info') {
    const box = $('#cloudSyncLog');
    if (!box) return;
    const row = document.createElement('div');
    row.dataset.kind = kind;
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    row.append(time, document.createTextNode(message));
    box.prepend(row);
    while (box.children.length > 20) box.lastElementChild.remove();
  }

  function renderCloudStatus() {
    if (!$('#cloudConnectionStatus')) return;
    $('#appsScriptUrl').value = cloudSettings.apiUrl || '';
    $('#cloudAutoSync').checked = !!cloudSettings.autoSync;
    $('#cloudSyncInterval').value = String(cloudSettings.intervalMinutes || 15);
    $('#cloudUsername').value = currentSession?.username || '';
    $('#cloudConnectionStatus').textContent = cloudSettings.apiUrl ? '已設定' : '尚未設定';
    $('#cloudConnectionDetail').textContent = cloudSettings.apiUrl ? '等待測試或同步' : '請貼上Apps Script /exec網址';
    $('#cloudLoginStatus').textContent = cloudToken ? `${cloudToken.username} 已登入` : '未登入';
    $('#cloudWorkspaceStatus').textContent = cloudToken?.workspace ? `工作區：${cloudToken.workspace}` : '家庭共用資料庫';
    $('#cloudRevisionStatus').textContent = `雲端 r${Number(cloudSettings.remoteRevision||0)}／本機基準 r${Number(cloudSettings.localBaseRevision||0)}`;
    $('#cloudRevisionDetail').textContent = cloudSettings.lastSyncAction || '尚未同步';
    $('#cloudLastSyncStatus').textContent = cloudSettings.lastSyncAt ? formatTime(cloudSettings.lastSyncAt) : '—';
    $('#cloudLastSyncDetail').textContent = cloudSettings.lastSyncMessage || '尚無紀錄';
  }

  function persistCloudForm() {
    try {
      cloudSettings.apiUrl = normalizeApiUrl($('#appsScriptUrl').value);
      cloudSettings.autoSync = $('#cloudAutoSync').checked;
      cloudSettings.intervalMinutes = Number($('#cloudSyncInterval').value) || 15;
      saveCloudSettings();
      renderCloudStatus();
      startAutoSync();
      addSyncLog('雲端同步設定已儲存。');
    } catch (error) {
      addSyncLog(error.message, 'error');
      alert(error.message);
    }
  }

  async function testCloudConnection() {
    try {
      persistCloudForm();
      $('#cloudConnectionStatus').textContent = '連線中';
      const result = await cloudRequest({ action: 'ping', clientVersion: '5.6.8' });
      $('#cloudConnectionStatus').textContent = '連線正常';
      $('#cloudConnectionDetail').textContent = result.database || 'Vehicle Hub Google Sheet';
      addSyncLog(`連線成功：${result.message || 'Apps Script服務正常'}`);
    } catch (error) {
      $('#cloudConnectionStatus').textContent = '連線失敗';
      $('#cloudConnectionDetail').textContent = error.message;
      addSyncLog(`連線失敗：${error.message}`, 'error');
    }
  }

  async function cloudLogin() {
    try {
      persistCloudForm();
      const username = currentSession?.username;
      const password = $('#cloudPassword').value;
      if (!username || !password) throw new Error('請輸入雲端密碼。');
      const result = await cloudRequest({ action: 'login', username, password, clientVersion: '5.6.8' });
      writeCloudToken({
        token: result.token,
        username,
        workspace: result.workspace,
        expiresAt: Number(result.expiresAt),
        revision: Number(result.revision || 0)
      });
      cloudSettings.remoteRevision = Number(result.revision || 0);
      saveCloudSettings();
      $('#cloudPassword').value = '';
      renderCloudStatus();
      addSyncLog(`${username} 已登入Google Sheets家庭資料庫。`);
      startAutoSync();
    } catch (error) {
      addSyncLog(`雲端登入失敗：${error.message}`, 'error');
      alert(error.message);
    }
  }

  function requireCloudToken() {
    cloudToken = readCloudToken();
    if (!cloudToken) throw new Error('雲端登入已失效，請重新輸入密碼登入。');
    return cloudToken;
  }

  function readLocalStateText() {
    const value = localStorage.getItem(DATA_STORAGE_KEY);
    if (!value) throw new Error('本機沒有可同步的車輛資料。');
    const parsed = safeJsonParse(value, null);
    if (!parsed?.vehicles) throw new Error('本機車輛資料格式不正確。');
    return { text: value, data: parsed };
  }

  function createExternalSnapshot(reason, data) {
    const rows = safeJsonParse(localStorage.getItem(SNAPSHOT_STORAGE_KEY), []) || [];
    rows.unshift({ id: `cloud-${Date.now()}`, createdAt: nowIso(), reason, schemaVersion: Number(data?.schemaVersion || 0), data });
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(rows.slice(0, 8)));
  }

  async function cloudPull() {
    try {
      const token = requireCloudToken();
      const result = await cloudRequest({ action: 'pull', token: token.token, clientVersion: '5.6.8' });
      if (!result.data) throw new Error('雲端尚未建立資料；請先從有完整資料的裝置上傳。');
      const current = safeJsonParse(localStorage.getItem(DATA_STORAGE_KEY), null);
      if (current) createExternalSnapshot('Google Sheet下載前保護快照', current);
      localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(result.data));
      cloudSettings.remoteRevision = Number(result.revision || 0);
      cloudSettings.localBaseRevision = Number(result.revision || 0);
      cloudSettings.lastSyncAt = nowIso();
      cloudSettings.lastSyncAction = '從Google Sheet下載';
      cloudSettings.lastSyncMessage = `已下載雲端版本 r${cloudSettings.remoteRevision}`;
      cloudSettings.lastPushedHash = await sha256(JSON.stringify(result.data));
      saveCloudSettings();
      addSyncLog(`已下載雲端版本 r${cloudSettings.remoteRevision}，系統即將重新載入。`);
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      addSyncLog(`下載失敗：${error.message}`, 'error');
      alert(error.message);
    }
  }

  async function cloudPush(force = false, silent = false) {
    try {
      const token = requireCloudToken();
      const local = readLocalStateText();
      const hash = await sha256(local.text);
      if (!force && hash === cloudSettings.lastPushedHash) {
        if (!silent) addSyncLog('本機資料沒有變更，不需重複上傳。');
        return;
      }
      // 上傳前先讀雲端revision。登入只更新remoteRevision，絕不把舊裝置誤當成已同步。
      const status = await cloudRequest({ action: 'status', token: token.token, clientVersion: '5.6.8' });
      cloudSettings.remoteRevision = Number(status.revision || 0);
      saveCloudSettings();
      if (!force && cloudSettings.remoteRevision !== Number(cloudSettings.localBaseRevision || 0)) {
        renderCloudStatus();
        throw new Error(`版本衝突：雲端為r${cloudSettings.remoteRevision}，本機最後同步基準為r${Number(cloudSettings.localBaseRevision||0)}。請先「從Google Sheet下載」，避免舊裝置覆蓋新資料。`);
      }
      const result = await cloudRequest({
        action: 'push', token: token.token, data: local.data,
        baseRevision: Number(cloudSettings.localBaseRevision || 0), force: !!force,
        clientVersion: '5.6.8'
      });
      cloudSettings.remoteRevision = Number(result.revision || 0);
      cloudSettings.localBaseRevision = Number(result.revision || 0);
      cloudSettings.lastSyncAt = nowIso();
      cloudSettings.lastSyncAction = force ? '強制覆蓋Google Sheet' : '上傳到Google Sheet';
      cloudSettings.lastSyncMessage = `雲端已更新至 r${cloudSettings.remoteRevision}`;
      cloudSettings.lastPushedHash = hash;
      saveCloudSettings();
      renderCloudStatus();
      addSyncLog(`上傳成功，雲端版本 r${cloudSettings.remoteRevision}。`);
    } catch (error) {
      if (/版本衝突/.test(error.message)) {
        addSyncLog('偵測到版本衝突：舊裝置已被阻止上傳，請先下載雲端最新版。', 'error');
      } else addSyncLog(`上傳失敗：${error.message}`, 'error');
      if (!silent) alert(error.message);
    }
  }

  function cloudLogout() {
    writeCloudToken(null);
    renderCloudStatus();
    addSyncLog('已登出Google Sheets雲端資料庫。');
    startAutoSync();
  }

  function startAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    if (!cloudSettings.autoSync || !readCloudToken()) return;
    const minutes = Math.max(5, Number(cloudSettings.intervalMinutes || 15));
    autoSyncTimer = setInterval(() => cloudPush(false, true), minutes * 60000);
  }

  function bindEvents() {
    $('#loginForm')?.addEventListener('submit', handleLogin);
    $('#toggleLoginPassword')?.addEventListener('click', () => {
      const input = $('#loginPassword');
      input.type = input.type === 'password' ? 'text' : 'password';
      $('#toggleLoginPassword').textContent = input.type === 'password' ? '顯示' : '隱藏';
    });
    const usernameInput = $('#loginUsername');
    const passwordInput = $('#loginPassword');
    prepareLoginFields();

    // V5.6.8: do not intercept taps on the account/password fields.
    // Safari must receive the untouched native tap so it can open the iPad keyboard.
    applyIPadNativeInputMode();

    $('#enableLoginUsername')?.addEventListener('click', () => {
      activateLoginInput(usernameInput, true);
      addSyncLog('已由使用者手勢重新啟用登入帳號欄，供iPad喚起螢幕鍵盤。');
    });
    $('#enableLoginPassword')?.addEventListener('click', () => {
      passwordInput?.setAttribute('inputmode', 'numeric');
      activateLoginInput(passwordInput, true);
      addSyncLog('已由使用者手勢重新啟用登入密碼欄，供iPad喚起螢幕鍵盤。');
    });
    $('#logoutButton')?.addEventListener('click', logout);
    $('#saveCloudSettings')?.addEventListener('click', persistCloudForm);
    $('#testCloudConnection')?.addEventListener('click', testCloudConnection);
    $('#cloudLoginButton')?.addEventListener('click', cloudLogin);
    $('#cloudLogoutButton')?.addEventListener('click', cloudLogout);
    $('#cloudPullButton')?.addEventListener('click', cloudPull);
    $('#cloudPushButton')?.addEventListener('click', () => cloudPush(false, false));
    $('#cloudForcePushButton')?.addEventListener('click', () => {
      if (confirm('強制覆蓋會以這台裝置的資料取代Google Sheet現有版本，確定繼續？')) cloudPush(true, false);
    });
    $('#cloudAutoSync')?.addEventListener('change', persistCloudForm);
    $('#cloudSyncInterval')?.addEventListener('change', persistCloudForm);
  }

  bindEvents();
  const session = readAuthSession();
  if (session) showApplication(session); else showLogin();
})();
