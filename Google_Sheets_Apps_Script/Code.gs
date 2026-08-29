'use strict';

const VEHICLE_HUB_VERSION = '5.6.6';
const USERS_SHEET = 'Users';
const DATA_SHEET = 'SystemData';
const AUDIT_SHEET = 'AuditLog';
const CONFIG_SHEET = 'Config';
const PAYLOAD_CHUNK_SIZE = 45000;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_BLOCK_SECONDS = 60;
const INITIAL_ACCOUNT_SALT = 'vehicle-hub-v542-initial';
const INITIAL_PASSWORD_HASH = '40e8d2a6cfa0b56287a3aca8e8485467aad63912c56c26f02f88f814e34b880b';
const COLLECTION_SHEETS = {
  vehicles: 'Vehicles', fuel: 'Fuel', maintenance: 'Maintenance', reminders: 'Reminders',
  obligations: 'Obligations', mileageLogs: 'MileageLogs', partInspections: 'PartInspections',
  unclassifiedRecords: 'UnclassifiedRecords', automationLog: 'AutomationLog'
};

function setupVehicleHubDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('請將此Apps Script綁定在一份Google Sheet。');
  ensureSheet_(ss, USERS_SHEET, ['username','displayName','workspace','salt','passwordHash','active','updatedAt']);
  ensureSheet_(ss, DATA_SHEET, ['workspace','revision','updatedAt','updatedBy','chunkIndex','chunkCount','payloadChunk']);
  ensureSheet_(ss, AUDIT_SHEET, ['timestamp','username','workspace','action','revision','message','clientVersion']);
  ensureSheet_(ss, CONFIG_SHEET, ['key','value','updatedAt']);
  Object.keys(COLLECTION_SHEETS).forEach(key => ensureSheet_(ss, COLLECTION_SHEETS[key], ['workspace','syncedAt','syncedBy','id','json']));
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  upsertUserHash_('dad', 'dad', 'family', INITIAL_ACCOUNT_SALT, INITIAL_PASSWORD_HASH);
  upsertUserHash_('mom', 'mom', 'family', INITIAL_ACCOUNT_SALT, INITIAL_PASSWORD_HASH);
  setConfig_('databaseVersion', VEHICLE_HUB_VERSION);
  setConfig_('spreadsheetId', ss.getId());
  return { ok: true, message: 'Vehicle Hub資料庫初始化完成', spreadsheetId: ss.getId(), users: ['dad','mom'] };
}

function setVehicleHubPassword(username, newPassword) {
  if (!username || !newPassword || String(newPassword).length < 4) throw new Error('帳號與至少4碼的新密碼不可空白。');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  if (!sheet) throw new Error('請先執行setupVehicleHubDatabase。');
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((row, i) => i > 0 && String(row[0]).toLowerCase() === String(username).toLowerCase());
  if (index < 0) throw new Error('找不到帳號：' + username);
  const salt = Utilities.getUuid();
  sheet.getRange(index + 1, 4, 1, 4).setValues([[salt, sha256Hex_(salt + ':' + newPassword), true, new Date().toISOString()]]);
  return { ok: true, message: username + ' 密碼已更新' };
}

function doGet(e) {
  return jsonOutput_({ ok: true, service: 'Vehicle Hub Google Sheets API', version: VEHICLE_HUB_VERSION, message: '服務正常', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const action = String(body.action || 'ping');
    if (action === 'ping') return jsonOutput_({ ok: true, message: 'Apps Script服務正常', database: SpreadsheetApp.getActiveSpreadsheet().getName(), version: VEHICLE_HUB_VERSION });
    if (action === 'login') return jsonOutput_(login_(body));
    const auth = verifyToken_(body.token);
    if (action === 'pull') return jsonOutput_(pull_(auth));
    if (action === 'push') return jsonOutput_(push_(auth, body));
    if (action === 'status') return jsonOutput_(status_(auth));
    throw new Error('不支援的action：' + action);
  } catch (error) {
    return jsonOutput_({ ok: false, message: String(error && error.message || error) });
  }
}

function login_(body) {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const throttle = loginThrottleState_(username);
  if (throttle.blocked) throw new Error('登入失敗次數過多，請稍後再試。');
  const user = findUser_(username);
  if (!user || !user.active || sha256Hex_(user.salt + ':' + password) !== user.passwordHash) {
    registerLoginFailure_(username);
    audit_(username || 'unknown', user ? user.workspace : '', 'login-failed', 0, '登入失敗', body.clientVersion);
    throw new Error('帳號或密碼不正確。');
  }
  clearLoginFailures_(username);
  const current = readWorkspace_(user.workspace);
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = createToken_(user.username, user.workspace, expiresAt);
  audit_(user.username, user.workspace, 'login', current.revision, '登入成功', body.clientVersion);
  return { ok: true, token: token, expiresAt: expiresAt, username: user.username, displayName: user.displayName, workspace: user.workspace, revision: current.revision, summary: summarizeData_(current.data) };
}

function pull_(auth) {
  const current = readWorkspace_(auth.workspace);
  audit_(auth.username, auth.workspace, 'pull', current.revision, current.data ? '下載資料' : '尚無雲端資料', '');
  return { ok: true, workspace: auth.workspace, revision: current.revision, updatedAt: current.updatedAt, updatedBy: current.updatedBy, data: current.data, summary: summarizeData_(current.data) };
}

function push_(auth, body) {
  if (!body.data || !Array.isArray(body.data.vehicles)) throw new Error('上傳資料格式不正確。');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const current = readWorkspace_(auth.workspace);
    const baseRevision = Number(body.baseRevision || 0);
    if (!body.force && current.revision !== baseRevision) {
      throw new Error('版本衝突：雲端為r' + current.revision + '，本機基準為r' + baseRevision + '。請先下載雲端資料。');
    }
    const revision = current.revision + 1;
    writeWorkspace_(auth.workspace, revision, auth.username, body.data);
    mirrorCollections_(auth.workspace, auth.username, body.data);
    audit_(auth.username, auth.workspace, body.force ? 'force-push' : 'push', revision, '上傳成功', body.clientVersion);
    return { ok: true, workspace: auth.workspace, revision: revision, updatedAt: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function status_(auth) {
  const current = readWorkspace_(auth.workspace);
  return { ok: true, workspace: auth.workspace, revision: current.revision, updatedAt: current.updatedAt, updatedBy: current.updatedBy, hasData: !!current.data, summary: summarizeData_(current.data) };
}

function loginThrottleKey_(username) {
  return 'vehicle-hub-login-' + String(username || 'unknown').replace(/[^a-z0-9_-]/gi, '_');
}

function loginThrottleState_(username) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get(loginThrottleKey_(username));
  const count = Number(raw || 0);
  return { count: count, blocked: count >= LOGIN_MAX_FAILURES };
}

function registerLoginFailure_(username) {
  const cache = CacheService.getScriptCache();
  const key = loginThrottleKey_(username);
  const next = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(next), LOGIN_BLOCK_SECONDS);
}

function clearLoginFailures_(username) {
  CacheService.getScriptCache().remove(loginThrottleKey_(username));
}

function summarizeData_(data) {
  if (!data || typeof data !== 'object') return { vehicles: 0, fuel: 0, maintenance: 0, reminders: 0, obligations: 0 };
  return {
    vehicles: Array.isArray(data.vehicles) ? data.vehicles.length : 0,
    fuel: Array.isArray(data.fuel) ? data.fuel.length : 0,
    maintenance: Array.isArray(data.maintenance) ? data.maintenance.length : 0,
    reminders: Array.isArray(data.reminders) ? data.reminders.length : 0,
    obligations: Array.isArray(data.obligations) ? data.obligations.length : 0
  };
}

function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  try { return JSON.parse(raw); } catch (_) { throw new Error('POST內容不是有效JSON。'); }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  return sheet;
}

function upsertUserHash_(username, displayName, workspace, salt, passwordHash) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((row, i) => i > 0 && String(row[0]).toLowerCase() === username);
  if (index >= 0) return;
  sheet.appendRow([username, displayName, workspace, salt, passwordHash, true, new Date().toISOString()]);
}

function upsertUser_(username, displayName, workspace, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((row, i) => i > 0 && String(row[0]).toLowerCase() === username);
  if (index >= 0) return;
  const salt = Utilities.getUuid();
  sheet.appendRow([username, displayName, workspace, salt, sha256Hex_(salt + ':' + password), true, new Date().toISOString()]);
}

function findUser_(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  if (!sheet) throw new Error('資料庫尚未初始化。');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === username) return { username: String(rows[i][0]), displayName: String(rows[i][1]), workspace: String(rows[i][2]), salt: String(rows[i][3]), passwordHash: String(rows[i][4]), active: rows[i][5] === true || String(rows[i][5]).toLowerCase() === 'true' };
  }
  return null;
}

function createToken_(username, workspace, expiresAt) {
  const payload = JSON.stringify({ username: username, workspace: workspace, expiresAt: expiresAt });
  const encoded = Utilities.base64EncodeWebSafe(payload, Utilities.Charset.UTF_8).replace(/=+$/g, '');
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encoded, secret)).replace(/=+$/g, '');
  return encoded + '.' + signature;
}

function verifyToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('雲端登入憑證不存在或格式錯誤。');
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret)).replace(/=+$/g, '');
  if (!constantTimeEqual_(expected, parts[1])) throw new Error('雲端登入憑證無效。');
  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (Number(payload.expiresAt || 0) <= Date.now()) throw new Error('雲端登入已逾期，請重新登入。');
  const user = findUser_(String(payload.username || '').toLowerCase());
  if (!user || !user.active || user.workspace !== payload.workspace) throw new Error('帳號已停用或工作區不一致。');
  return { username: user.username, workspace: user.workspace };
}

function constantTimeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function readWorkspace_(workspace) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { revision: 0, updatedAt: '', updatedBy: '', data: null };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues().filter(row => String(row[0]) === workspace);
  if (!rows.length) return { revision: 0, updatedAt: '', updatedBy: '', data: null };
  rows.sort((a, b) => Number(a[4]) - Number(b[4]));
  const payload = rows.map(row => String(row[6] || '')).join('');
  return { revision: Number(rows[0][1] || 0), updatedAt: String(rows[0][2] || ''), updatedBy: String(rows[0][3] || ''), data: payload ? JSON.parse(payload) : null };
}

function writeWorkspace_(workspace, revision, username, data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  const existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues() : [];
  const keep = existing.filter(row => String(row[0]) !== workspace);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 7).setValues([['workspace','revision','updatedAt','updatedBy','chunkIndex','chunkCount','payloadChunk']]).setFontWeight('bold');
  if (keep.length) sheet.getRange(2, 1, keep.length, 7).setValues(keep);
  const payload = JSON.stringify(data);
  const chunks = [];
  for (let i = 0; i < payload.length; i += PAYLOAD_CHUNK_SIZE) chunks.push(payload.slice(i, i + PAYLOAD_CHUNK_SIZE));
  const updatedAt = new Date().toISOString();
  const rows = chunks.map((chunk, index) => [workspace, revision, updatedAt, username, index + 1, chunks.length, chunk]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

function mirrorCollections_(workspace, username, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const syncedAt = new Date().toISOString();
  Object.keys(COLLECTION_SHEETS).forEach(key => {
    const sheet = ss.getSheetByName(COLLECTION_SHEETS[key]);
    const values = Array.isArray(data[key]) ? data[key] : [];
    sheet.clearContents();
    sheet.getRange(1, 1, 1, 5).setValues([['workspace','syncedAt','syncedBy','id','json']]).setFontWeight('bold');
    if (!values.length) return;
    const rows = values.map((item, index) => [workspace, syncedAt, username, String(item && item.id || index + 1), JSON.stringify(item)]);
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    sheet.setFrozenRows(1);
  });
}

function audit_(username, workspace, action, revision, message, clientVersion) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_SHEET);
  if (!sheet) return;
  sheet.appendRow([new Date().toISOString(), username, workspace, action, revision, message, clientVersion || '']);
}

function setConfig_(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((row, i) => i > 0 && String(row[0]) === key);
  if (index >= 0) sheet.getRange(index + 1, 2, 1, 2).setValues([[String(value), new Date().toISOString()]]);
  else sheet.appendRow([key, String(value), new Date().toISOString()]);
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
