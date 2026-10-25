/**
 * Payroll API Client for Violations
 * Handles topup payments for violations using Payroll API
 */

// Cache config after first load
let configCache = null;

/**
 * Get and validate config (lazy evaluation)
 */
function getConfig() {
  if (configCache) {
    return configCache;
  }

  const baseUrl = process.env.PAYROLL_API_BASE_URL;
  const apiKey = process.env.PAYROLL_API_KEY;

  if (!baseUrl) {
    throw new Error('[Payroll API - Violation] PAYROLL_API_BASE_URL is required in .env');
  }

  if (!apiKey) {
    throw new Error('[Payroll API - Violation] PAYROLL_API_KEY is required in .env');
  }

  configCache = { baseUrl, apiKey };
  return configCache;
}

/**
 * Create headers for API request
 */
function getHeaders() {
  const config = getConfig();
  
  return {
    'x-api-key': config.apiKey,
    'Content-Type': 'application/json'
  };
}

/**
 * Retry logic with exponential backoff
 * @param {Function} fn 
 * @param {number} maxAttempts 
 */
async function retryWithBackoff(fn, maxAttempts = 3) {
  const delays = [2000, 4000, 8000]; // 2s, 4s, 8s
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      
      // 409 (conflict) and 503 (service unavailable) are temporary errors - retry
      if (result.shouldRetry && attempt < maxAttempts) {
        const delay = delays[attempt - 1] || 8000;
        console.log(`[Payroll API - Violation] Retrying after ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return result;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = delays[attempt - 1] || 8000;
      console.log(`[Payroll API - Violation] Error on attempt ${attempt}, retrying after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Topup for violation payment
 * Transfer coins from user wallet to bot wallet
 * @param {Object} params
 * @param {string} params.violationId - Violation ID
 * @param {string} params.payerId - User ID who is paying
 * @param {number} params.amount - Amount to pay
 * @param {string} params.reason - Reason for payment
 */
export async function topupForViolation({ violationId, payerId, amount, reason }) {
  const config = getConfig();

  if (typeof payerId !== 'string' || !/^\d+$/.test(payerId)) {
    throw new TypeError('[Payroll API - Violation] payerId must be a Discord ID string containing digits only');
  }

  if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
    throw new TypeError('[Payroll API - Violation] amount must be a positive integer');
  }

  return retryWithBackoff(async () => {
    try {
      const timestamp = Date.now();
      const reference = `violation-${violationId}-${timestamp}`;

      const requestBody = {
        reference,
        userId: payerId,
        amount,
        reason
      };

      console.log('[Payroll API - Violation] Sending topup:', JSON.stringify(requestBody));

      const response = await fetch(`${config.baseUrl}/topup`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log(
        `[Payroll API - Violation] Topup response (HTTP ${response.status}):`,
        JSON.stringify(data)
      );

      // 409 and 503 should retry
      if (response.status === 409 || response.status === 503) {
        return {
          shouldRetry: true,
          status: response.status,
          data
        };
      }

      // 403/404 are not retryable - return response for caller to handle
      if (response.status === 403 || response.status === 404) {
        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: response.status
        };
      }

      // 200 - success (duplicate:true is also 200)
      if (response.status === 200) {
        return {
          shouldRetry: false,
          status: response.status,
          data,
          httpStatus: 200
        };
      }

      // Other errors - return for caller to handle
      return {
        shouldRetry: false,
        status: response.status,
        data,
        httpStatus: response.status
      };

    } catch (error) {
      console.error('[Payroll API - Violation] Topup error:', error);
      throw error;
    }
  });
}
