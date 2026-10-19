/**
 * BCN Database Connection
 * Ket noi voi database BCN chua collection members
 */

import { MongoClient } from 'mongodb';

let bcnClient = null;
let bcnDb = null;

/**
 * Ket noi den BCN database
 */
export async function connectBCN() {
  if (bcnDb) {
    return bcnDb;
  }

  // Lay URI tu env (atlas-credentials.env)
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is required in atlas-credentials.env');
  }

  try {
    console.log('[BCN] Connecting to BCN database...');
    bcnClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await bcnClient.connect();
    bcnDb = bcnClient.db('BCN');

    console.log('[BCN] Connected successfully to BCN database');
    return bcnDb;
  } catch (error) {
    console.error('[BCN] Connection failed:', error);
    throw error;
  }
}

/**
 * Lay BCN database instance
 */
export function getBCNDatabase() {
  if (!bcnDb) {
    throw new Error('[BCN] Database not connected. Call connectBCN() first.');
  }
  return bcnDb;
}

/**
 * Dong ket noi BCN database
 */
export async function closeBCN() {
  if (bcnClient) {
    await bcnClient.close();
    bcnClient = null;
    bcnDb = null;
    console.log('[BCN] Connection closed');
  }
}
