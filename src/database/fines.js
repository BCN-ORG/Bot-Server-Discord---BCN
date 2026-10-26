import { getDatabase } from './mongodb.js';

const COLLECTION_NAME = 'fines';
const CONFIG_COLLECTION_NAME = 'fine_config';

/**
 * Initialize indexes for fines collection
 */
export async function initFineIndexes() {
  try {
    const db = getDatabase();
    const collection = db.collection(COLLECTION_NAME);
    
    // Index for fineId (unique)
    await collection.createIndex({ fineId: 1 }, { unique: true });
    
    // Compound index for guildId + userId (for filtering)
    await collection.createIndex({ guildId: 1, userId: 1 });
    
    // Compound index for guildId + isPaid (for filtering unpaid fines)
    await collection.createIndex({ guildId: 1, isPaid: 1 });
    
    // Index for createdAt (for sorting)
    await collection.createIndex({ createdAt: -1 });
    
    console.log('[Fines] Indexes initialized successfully');
  } catch (error) {
    console.error('[Fines] Error initializing indexes:', error);
    throw error;
  }
}

/**
 * Generate unique fineId in format FINE-YYYYMMDD-XXX
 */
export async function generateFineId() {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  // Find the latest fine for today
  const latestFine = await collection
    .find({ fineId: { $regex: `^FINE-${dateStr}-` } })
    .sort({ fineId: -1 })
    .limit(1)
    .toArray();
  
  let sequence = 1;
  if (latestFine.length > 0) {
    const lastId = latestFine[0].fineId;
    const lastSequence = parseInt(lastId.split('-')[2], 10);
    sequence = lastSequence + 1;
  }
  
  const sequenceStr = sequence.toString().padStart(3, '0');
  return `FINE-${dateStr}-${sequenceStr}`;
}

/**
 * Create a new fine
 */
export async function createFine(guildId, userId, username, reason, amount, createdBy) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const fineId = await generateFineId();
  const now = new Date();
  
  const fine = {
    fineId,
    guildId,
    userId,
    username,
    reason,
    amount,
    isPaid: false,
    paidAt: null,
    paidBy: null,
    payrollReference: null,
    createdBy,
    createdAt: now,
    updatedAt: now
  };
  
  await collection.insertOne(fine);
  return fine;
}

/**
 * Get fine by fineId
 */
export async function getFineById(fineId) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  return await collection.findOne({ fineId });
}

/**
 * Get fines by user
 */
export async function getFinesByUser(guildId, userId, isPaid = null) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const filter = { guildId, userId };
  if (isPaid !== null) {
    filter.isPaid = isPaid;
  }
  
  return await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Get all fines with pagination and filters
 */
export async function getAllFines(guildId, filters = {}, page = 1, limit = 10) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const query = { guildId };
  
  if (filters.userId) {
    query.userId = filters.userId;
  }
  
  if (filters.status === 'paid') {
    query.isPaid = true;
  } else if (filters.status === 'unpaid') {
    query.isPaid = false;
  }
  
  const skip = (page - 1) * limit;
  
  const fines = await collection
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  
  const total = await collection.countDocuments(query);
  
  return {
    fines,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get all unpaid fines for a guild
 */
export async function getUnpaidFines(guildId) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  return await collection
    .find({ guildId, isPaid: false })
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Mark fine as paid
 */
export async function markFineAsPaid(fineId, paidBy, payrollReference) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { fineId },
    {
      $set: {
        isPaid: true,
        paidAt: new Date(),
        paidBy,
        payrollReference,
        updatedAt: new Date()
      }
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Get fine config for a guild
 */
export async function getFineConfig(guildId) {
  const db = getDatabase();
  const collection = db.collection(CONFIG_COLLECTION_NAME);
  
  let config = await collection.findOne({ guildId });
  
  if (!config) {
    // Create default config
    config = {
      guildId,
      authorizedRoles: [],
      reminderTimes: [],
      announcementChannels: [],
      updatedAt: new Date()
    };
    await collection.insertOne(config);
  }
  
  return config;
}

/**
 * Add authorized role
 */
export async function addAuthorizedRole(guildId, roleId) {
  const db = getDatabase();
  const collection = db.collection(CONFIG_COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { guildId },
    {
      $addToSet: { authorizedRoles: roleId },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
  
  return result.modifiedCount > 0 || result.upsertedCount > 0;
}

/**
 * Remove authorized role
 */
export async function removeAuthorizedRole(guildId, roleId) {
  const db = getDatabase();
  const collection = db.collection(CONFIG_COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { guildId },
    {
      $pull: { authorizedRoles: roleId },
      $set: { updatedAt: new Date() }
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Add reminder time
 */
export async function addReminderTime(guildId, hour, minute) {
  const db = getDatabase();
  const collection = db.collection(CONFIG_COLLECTION_NAME);
  
  // Check if time already exists
  const config = await getFineConfig(guildId);
  const exists = config.reminderTimes.some(
    t => t.hour === hour && t.minute === minute
  );
  
  if (exists) {
    return { success: false, message: 'Giờ nhắc này đã tồn tại' };
  }
  
  const result = await collection.updateOne(
    { guildId },
    {
      $push: { reminderTimes: { hour, minute } },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
  
  return {
    success: result.modifiedCount > 0 || result.upsertedCount > 0,
    message: 'Đã thêm giờ nhắc thành công'
  };
}

/**
 * Remove reminder time
 */
export async function removeReminderTime(guildId, hour, minute) {
  const db = getDatabase();
  const collection = db.collection(CONFIG_COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { guildId },
    {
      $pull: { reminderTimes: { hour, minute } },
      $set: { updatedAt: new Date() }
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Add announcement channel
 */
export async function addAnnouncementChannel(guildId, channelId) {
  const db = getDatabase();
  const collection = db.collection(CONFIG_COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { guildId },
    {
      $addToSet: { announcementChannels: channelId },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
  
  return result.modifiedCount > 0 || result.upsertedCount > 0;
}

/**
 * Remove announcement channel
 */
export async function removeAnnouncementChannel(guildId, channelId) {
  const db = getDatabase();
  const collection = db.collection(CONFIG_COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { guildId },
    {
      $pull: { announcementChannels: channelId },
      $set: { updatedAt: new Date() }
    }
  );
  
  return result.modifiedCount > 0;
}
