/**
 * Payroll API Client for Fine System
 * Uses /topup endpoint to transfer coins from payer to bot wallet
 */

let configCache = null;

/**
 * Get and validate config
 */
function getConfig() {
  if (configCache) {
    return configCache;
  }

  const baseUrl = process.env.PAYROLL_API_BASE_URL;
  const apiKey = process.env.PAYROLL_API_KEY;

  if (!baseUrl) {
    throw new Error('[Payroll Fine API] PAYROLL_API_BASE_URL is required in .env');
  }

  if (!apiKey) {
    throw new Error('[Payroll Fine API] PAYROLL_API_KEY is required in .env');
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
 * Pay fine using /topup endpoint
 * Transfers coins from user wallet to bot wallet
 * @param {string} fineId - Fine ID for reference
 * @param {string} userId - User ID who is paying
 * @param {number} amount - Amount in coins
 * @param {string} reason - Reason for payment
 */
export async function payFineWithTopup(fineId, userId, amount, reason) {
  const config = getConfig();

  if (typeof userId !== 'string' || !/^\d+$/.test(userId)) {
    throw new TypeError('[Payroll Fine API] userId must be a Discord ID string containing digits only');
  }

  try {
    const reference = `fine-${fineId}-${Date.now()}`;
    
    const requestBody = {
      reference,
      userId,
      amount,
      reason
    };

    console.log('[Payroll Fine API] Sending topup:', JSON.stringify(requestBody));

    const response = await fetch(`${config.baseUrl}/topup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    console.log(
      `[Payroll Fine API] Topup response (HTTP ${response.status}):`,
      JSON.stringify(data)
    );

    // Handle responses
    if (response.status === 200) {
      return {
        success: data.status === 'SUCCESS',
        duplicate: data.duplicate || false,
        reference: data.reference,
        data,
        httpStatus: 200
      };
    }

    // Error responses
    return {
      success: false,
      data,
      httpStatus: response.status
    };

  } catch (error) {
    console.error('[Payroll Fine API] Topup error:', error);
    throw error;
  }
}
