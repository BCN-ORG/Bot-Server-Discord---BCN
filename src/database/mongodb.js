import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Kết nối đến MongoDB Atlas
 */
export async function connectMongoDB() {
  if (db) {
    return db; // Đã kết nối rồi
  }

  // Lấy URI từ env (sau khi dotenv.config() đã chạy)
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'discord-bot';

  // Kiểm tra biến môi trường
  if (!uri) {
    console.error('[MongoDB] MONGODB_URI không được định nghĩa trong .env');
    console.error('[MongoDB] Vui lòng kiểm tra file .env có chứa MONGODB_URI');
    console.error('[MongoDB] Current env variables:', Object.keys(process.env).filter(k => k.includes('MONGO')));
    throw new Error('MONGODB_URI is required');
  }

  try {
    console.log('[MongoDB] Connecting to MongoDB Atlas...');
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    db = client.db(dbName);

    console.log(`[MongoDB] Connected successfully to database: ${dbName}`);
    return db;
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error);
    throw error;
  }
}

/**
 * Lấy database instance
 */
export function getDatabase() {
  if (!db) {
    throw new Error('[MongoDB] Database not connected. Call connectMongoDB() first.');
  }
  return db;
}

/**
 * Đóng kết nối MongoDB
 */
export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed');
  }
}
