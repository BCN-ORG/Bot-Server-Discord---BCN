import https from 'node:https';
import tls from 'node:tls';
import { readFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  deleteScheduleCredentials,
  getScheduleCredentials,
  saveScheduleCredentials
} from '../../../database/schedule.js';

const TOKEN_URL = 'https://mobile.oneuni.com.vn/AUTH/connect/token';
const API_URL = 'https://sv.iuh.edu.vn/AppSVGV/api/';
const CLIENT_ID = 'mobile_flutter';
const USER_AGENT = 'Dart/3.7 (dart:io)';
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const refreshes = new Map();
const issuerCertificate = await readFile(
  fileURLToPath(new URL('./schedule-ca.pem', import.meta.url)),
  'utf8'
);
const apiAgent = new https.Agent({
  ca: [...tls.rootCertificates, issuerCertificate]
});

export class ScheduleLoginRequiredError extends Error {
  constructor() {
    super('Bạn cần đăng nhập lại bằng lệnh /lich-hoc-login.');
    this.name = 'ScheduleLoginRequiredError';
  }
}

function getEncryptionKey() {
  const configuredKey = process.env.SCHEDULE_TOKEN_ENCRYPTION_KEY;
  if (!configuredKey || !/^[\da-f]{64}$/i.test(configuredKey)) {
    throw new Error('SCHEDULE_TOKEN_ENCRYPTION_KEY phải là khóa hex 64 ký tự (32 byte).');
  }
  return Buffer.from(configuredKey, 'hex');
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
}

function decrypt(value) {
  const [encodedIv, encodedTag, encodedCiphertext] = value.split('.');
  if (!encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error('Thông tin đăng nhập đã lưu không hợp lệ.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(encodedIv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function requestJson(url, { method = 'POST', headers = {}, body, agent } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method, headers, agent }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data;
        try {
          data = JSON.parse(raw || '{}');
        } catch {
          reject(new Error('Máy chủ lịch học trả về dữ liệu không hợp lệ.'));
          return;
        }
        resolve({ status: response.statusCode || 502, data });
      });
    });

    request.setTimeout(20_000, () => request.destroy(new Error('Kết nối tới máy chủ lịch học quá thời gian.')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function requestTokens(fields) {
  const clientSecret = process.env.SCHEDULE_API_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('Chưa cấu hình SCHEDULE_API_CLIENT_SECRET để kết nối dịch vụ lịch học.');
  }

  const body = new URLSearchParams({
    ...fields,
    client_id: CLIENT_ID,
    client_secret: clientSecret,
    scope: 'offline_access openid'
  }).toString();
  const response = await requestJson(TOKEN_URL, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': USER_AGENT
    },
    body
  });
  const { data, status } = response;
  if (status < 200 || status >= 300 || !data.access_token) {
    const message = data.errorMessages?.map(error => error.errorMessage).join('; ')
      || data.error_description
      || 'Đăng nhập thất bại. Hãy kiểm tra mã sinh viên và mật khẩu.';
    throw Object.assign(new Error(message), { status });
  }
  return data;
}

export async function loginToSchedule(discordUserId, studentId, password) {
  getEncryptionKey();
  const normalizedId = studentId.trim();
  const result = await requestTokens({
    url_uni: 'https://sv.iuh.edu.vn/AppSVGV/',
    username: /2IUH$/i.test(normalizedId) ? normalizedId : `${normalizedId}2IUH`,
    password,
    grant_type: 'password'
  });
  const refreshToken = result.refresh_token;
  if (!refreshToken) {
    throw new Error('Dịch vụ không cấp refresh token; không thể duy trì phiên đăng nhập.');
  }
  await saveScheduleCredentials(discordUserId, {
    accessToken: encrypt(result.access_token),
    refreshToken: encrypt(refreshToken),
    accessTokenExpiresAt: new Date(Date.now() + Number(result.expires_in || 1800) * 1000)
  });
}

async function refreshCredentials(discordUserId, credentials) {
  let refreshToken;
  try {
    refreshToken = decrypt(credentials.refreshToken);
  } catch (error) {
    await deleteScheduleCredentials(discordUserId);
    throw new ScheduleLoginRequiredError();
  }

  let result;
  try {
    result = await requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      await deleteScheduleCredentials(discordUserId);
      throw new ScheduleLoginRequiredError();
    }
    throw error;
  }

  const nextRefreshToken = result.refresh_token || refreshToken;
  await saveScheduleCredentials(discordUserId, {
    accessToken: encrypt(result.access_token),
    refreshToken: encrypt(nextRefreshToken),
    accessTokenExpiresAt: new Date(Date.now() + Number(result.expires_in || 1800) * 1000)
  });
  return result.access_token;
}

async function getAccessToken(discordUserId, forceRefresh = false, rejectedToken = null) {
  const credentials = await getScheduleCredentials(discordUserId);
  if (!credentials) throw new ScheduleLoginRequiredError();
  if (forceRefresh && rejectedToken) {
    try {
      const currentToken = decrypt(credentials.accessToken);
      if (currentToken !== rejectedToken) return currentToken;
    } catch {
      await deleteScheduleCredentials(discordUserId);
      throw new ScheduleLoginRequiredError();
    }
  }
  if (
    !forceRefresh
    && credentials.accessTokenExpiresAt instanceof Date
    && credentials.accessTokenExpiresAt.getTime() - Date.now() > TOKEN_REFRESH_MARGIN_MS
  ) {
    try {
      return decrypt(credentials.accessToken);
    } catch {
      await deleteScheduleCredentials(discordUserId);
      throw new ScheduleLoginRequiredError();
    }
  }

  if (!refreshes.has(discordUserId)) {
    const pending = refreshCredentials(discordUserId, credentials).finally(() => refreshes.delete(discordUserId));
    refreshes.set(discordUserId, pending);
  }
  return refreshes.get(discordUserId);
}

async function postScheduleApi(accessToken, date) {
  const body = JSON.stringify({
    loaiLich: 0,
    tuNgay: `${date}T00:00:00.000`,
    denNgay: `${date}T00:00:00.000`
  });
  const response = await requestJson(`${API_URL}v1/SinhVien/LichHocLichThi`, {
    agent: apiAgent,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': USER_AGENT
    },
    body
  });
  const { data, status } = response;
  if (status === 401) return { unauthorized: true };
  if (status < 200 || status >= 300 || data.isOk === false) {
    const message = data.errorMessages?.map(error => error.errorMessage).join('; ')
      || 'Không tải được lịch học. Vui lòng thử lại sau.';
    throw new Error(message);
  }
  return { result: Array.isArray(data.result) ? data.result : [] };
}

export async function getScheduleForDate(discordUserId, date) {
  let token = await getAccessToken(discordUserId);
  let response = await postScheduleApi(token, date);
  if (response.unauthorized) {
    token = await getAccessToken(discordUserId, true, token);
    response = await postScheduleApi(token, date);
  }
  if (response.unauthorized) {
    await deleteScheduleCredentials(discordUserId);
    throw new ScheduleLoginRequiredError();
  }
  return response.result;
}
