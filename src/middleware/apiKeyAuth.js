import { createHash, timingSafeEqual } from 'node:crypto';

const hashKey = key => createHash('sha256').update(key).digest();

export function createApiKeyAuth(apiKeys = '') {
  const keyHashes = apiKeys
    .split(',')
    .map(key => key.trim())
    .filter(Boolean)
    .map(hashKey);

  return (req, res, next) => {
    if (keyHashes.length === 0) {
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'API key authentication is not configured'
      });
    }

    const suppliedKey = req.get('X-API-Key');
    if (typeof suppliedKey !== 'string' || suppliedKey.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'A valid API key is required'
      });
    }

    const suppliedHash = hashKey(suppliedKey);
    const isValid = keyHashes.some(keyHash => timingSafeEqual(suppliedHash, keyHash));

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'A valid API key is required'
      });
    }

    next();
  };
}
