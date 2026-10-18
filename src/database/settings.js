import { getDatabase } from './mongodb.js';

/**
 * Collection name
 */
const COLLECTION_NAME = 'settings';

/**
 * Setting keys
 */
export const SettingKey = {
  SCHEDULER_ENABLED: 'scheduler_enabled'
};

/**
 * Lay gia tri setting
 * @param {string} key - Setting key
 * @param {*} defaultValue - Gia tri mac dinh neu khong ton tai
 * @returns {Promise<*>}
 */
export async function getSetting(key, defaultValue = null) {
  try {
    const db = getDatabase();
    const collection = db.collection(COLLECTION_NAME);
    
    const setting = await collection.findOne({ key });
    
    if (!setting) {
      return defaultValue;
    }
    
    return setting.value;
  } catch (error) {
    console.error(`[ERROR] Failed to get setting ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Luu gia tri setting
 * @param {string} key - Setting key
 * @param {*} value - Gia tri
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  try {
    const db = getDatabase();
    const collection = db.collection(COLLECTION_NAME);
    
    await collection.updateOne(
      { key },
      { 
        $set: { 
          value,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[INFO] Setting ${key} updated to:`, value);
  } catch (error) {
    console.error(`[ERROR] Failed to set setting ${key}:`, error);
    throw error;
  }
}

/**
 * Xoa setting
 * @param {string} key - Setting key
 * @returns {Promise<void>}
 */
export async function deleteSetting(key) {
  try {
    const db = getDatabase();
    const collection = db.collection(COLLECTION_NAME);
    
    await collection.deleteOne({ key });
    
    console.log(`[INFO] Setting ${key} deleted`);
  } catch (error) {
    console.error(`[ERROR] Failed to delete setting ${key}:`, error);
    throw error;
  }
}
