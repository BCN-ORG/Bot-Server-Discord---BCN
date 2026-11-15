/**
 * Payroll API Client
 * Su dung native fetch (Node.js 18+) de goi API tra luong
 */

// Cache config sau khi load lan dau
let configCache = null;

/**
 * Lay va validate config (lazy evaluation)
 * Chi doc env vars khi function duoc goi, khong doc o module top-level
 */
function getConfig() {
  if (configCache) {
    return configCache;
  }

  const baseUrl = process.env.PAYROLL_API_BASE_URL;
  const apiKey = process.env.PAYROLL_API_KEY;

  if (!baseUrl) {
    throw new Error('[Payroll API] PAYROLL_API_BASE_URL is required in .env');
  }

  if (!apiKey) {
    throw new Error('[Payroll API] PAYROLL_API_KEY is required in .env');
  }

  configCache = { baseUrl, apiKey };
  return configCache;
}

/**
 * Tao headers cho API request
 */
function getHeaders() {
  const config = getConfig();
  
  return {
    'x-api-key': config.apiKey,
    'Content-Type': 'application/json'
  };
}

/**
 * Retry logic voi exponential backoff
 * @param {Function} fn 
 * @param {number} maxAttempts 
 */
async function retryWithBackoff(fn, maxAttempts = 3) {
  const delays = [2000, 4000, 8000]; // 2s, 4s, 8s
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      
      // 409 (conflict) va 503 (service unavailable) la loi tam thoi - retry
      if (result.shouldRetry && attempt < maxAttempts) {
        const delay = delays[attempt - 1] || 8000;
        console.log(`[Payroll API] Retrying after ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return result;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = delays[attempt - 1] || 8000;
      console.log(`[Payroll API] Error on attempt ${attempt}, retrying after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Chuyen coins tu user cho bot (payment) - dung API topup
 * User tu nguyen tra tien de nhan role
 * @param {string} userId - Discord user ID
 * @param {number} amount - So coins can chuyen
 * @param {string} description - Mo ta giao dich
 * @returns {Promise<Object>} Response data
 */
export async function chargeCoins(userId, amount, description) {
  const config = getConfig();

  if (typeof userId !== 'string' || !/^\d+$/.test(userId)) {
    throw new TypeError('[Payroll API] userId must be a Discord ID string containing digits only');
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw new TypeError('[Payroll API] amount must be a positive number');
  }

  // Tao reference duy nhat cho moi giao dich
  const timestamp = Date.now();
  const reference = `reaction-role-${timestamp}-${userId}`;

  return retryWithBackoff(async () => {
    try {
      const requestBody = {
        reference,
        userId,
        amount,
        reason: description || 'Nhận role qua reaction'
      };

      console.log('[Payroll API] Charging coins via /topup:', JSON.stringify(requestBody));

      const response = await fetch(`${config.baseUrl}/topup`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log(
        `[Payroll API] Topup response (HTTP ${response.status}):`,
        JSON.stringify(data)
      );

      // 409 va 503 can retry
      if (response.status === 409 || response.status === 503) {
        return {
          shouldRetry: true,
          status: response.status,
          data
        };
      }

      // 200 - chỉ thành công khi API xác nhận SUCCESS.
      if (response.status === 200) {
        if (data.status === 'FAILED') {
          return {
            shouldRetry: false,
            status: response.status,
            data,
            httpStatus: 200,
            insufficientBalance: true
          };
        }

        if (data.status !== 'SUCCESS') {
          throw new Error(
            `[Payroll API] Topup was not successful: ${data.status || 'missing status'}`
          );
        }

        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: 200,
          duplicate: data.duplicate || false
        };
      }

      // 403/404 - user khong co hoac khong phai member
      if (response.status === 403 || response.status === 404) {
        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: response.status,
          insufficientBalance: response.status === 403
        };
      }

      // Cac loi khac
      return {
        shouldRetry: false,
        status: response.status,
        data,
        httpStatus: response.status
      };
    } catch (error) {
      console.error('[Payroll API] Charge error:', error);
      throw error;
    }
  });
}

/**
 * Tra luong cho mot user
 * @param {string} userId 
 * @param {string} roleId 
 * @param {number} amount 
 * @param {string} description 
 */
export async function transferPayment(userId, roleId, amount, description) {
  const config = getConfig();

  if (typeof userId !== 'string' || !/^\d+$/.test(userId)) {
    throw new TypeError('[Payroll API] userId must be a Discord ID string containing digits only');
  }

  if (typeof roleId !== 'string' || !/^\d+$/.test(roleId)) {
    throw new TypeError('[Payroll API] roleId must be a Discord ID string containing digits only');
  }

  return retryWithBackoff(async () => {
    try {
      const requestBody = {
        userId,
        roleId,
        amount,
        description
      };

      console.log('[Payroll API] Sending transfer:', JSON.stringify(requestBody));

      const response = await fetch(`${config.baseUrl}/transfer`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log(
        `[Payroll API] Transfer response (HTTP ${response.status}):`,
        JSON.stringify(data)
      );

      // 409 va 503 can retry
      if (response.status === 409 || response.status === 503) {
        return {
          shouldRetry: true,
          status: response.status,
          data
        };
      }

      // 403/404 khong phai loi - tra ve response de caller xu ly
      if (response.status === 403 || response.status === 404) {
        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: response.status
        };
      }

      // 200 - thanh cong (duplicate:true cung la 200)
      if (response.status === 200) {
        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: 200
        };
      }

      // Cac loi khac - tra ve de caller xu ly
      return {
        shouldRetry: false,
        status: response.status,
        data,
        httpStatus: response.status
      };

    } catch (error) {
      console.error('[Payroll API] Transfer error:', error);
      throw error;
    }
  });
}

/**
 * Lay so du vi bot
 */
export async function getBalance() {
  const config = getConfig();

  try {
    const response = await fetch(`${config.baseUrl}/balance`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get balance');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Payroll API] Get balance error:', error);
    throw error;
  }
}

/**
 * Lay danh sach da tra luong
 * @param {string} period 
 * @param {string} roleId 
 */
export async function getPayouts(period, roleId) {
  const config = getConfig();

  try {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (roleId) params.append('roleId', roleId);

    const url = `${config.baseUrl}/payouts?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get payouts');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Payroll API] Get payouts error:', error);
    throw error;
  }
}

/**
 * Nap coin cho bot (topup)
 * @param {string} reference - Ma giao dich duy nhat
 * @param {string} userId - Discord user ID nguoi nap
 * @param {number} amount - So coin
 * @param {string} reason - Ly do
 */
export async function topupCoin(reference, userId, amount, reason) {
  const config = getConfig();

  if (typeof userId !== 'string' || !/^\d+$/.test(userId)) {
    throw new TypeError('[Payroll API] userId must be a Discord ID string containing digits only');
  }

  if (typeof reference !== 'string' || reference.length === 0 || reference.length > 100) {
    throw new TypeError('[Payroll API] reference must be a string (1-100 characters)');
  }

  return retryWithBackoff(async () => {
    try {
      const requestBody = {
        reference,
        userId,
        amount,
        reason
      };

      console.log('[Payroll API] Sending topup:', JSON.stringify(requestBody));

      const response = await fetch(`${config.baseUrl}/topup`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log(
        `[Payroll API] Topup response (HTTP ${response.status}):`,
        JSON.stringify(data)
      );

      // 409 va 503 can retry
      if (response.status === 409 || response.status === 503) {
        return {
          shouldRetry: true,
          status: response.status,
          data
        };
      }

      // 403/404 khong phai loi - tra ve response de caller xu ly
      if (response.status === 403 || response.status === 404) {
        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: response.status
        };
      }

      // 200 - thanh cong (duplicate:true cung la 200)
      if (response.status === 200) {
        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: 200
        };
      }

      // Cac loi khac - tra ve de caller xu ly
      return {
        shouldRetry: false,
        status: response.status,
        data,
        httpStatus: response.status
      };

    } catch (error) {
      console.error('[Payroll API] Topup error:', error);
      throw error;
    }
  });
}


/**
 * Lay lich su tru/nap coin (adjustments)
 * @param {string} type - 'DEDUCT' hoac 'TOPUP' hoac null (all)
 * @param {string} userId - Discord user ID hoac null (all)
 */
export async function getAdjustments(type, userId) {
  const config = getConfig();

  try {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (userId) params.append('userId', userId);

    const url = `${config.baseUrl}/adjustments?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get adjustments');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Payroll API] Get adjustments error:', error);
    throw error;
  }
}
