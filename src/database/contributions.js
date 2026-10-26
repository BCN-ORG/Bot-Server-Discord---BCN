import { getDatabase } from './mongodb.js';

const COLLECTION_NAME = 'contributions';

/**
 * Initialize indexes for contributions collection
 */
export async function initContributionIndexes() {
  try {
    const db = getDatabase();
    const collection = db.collection(COLLECTION_NAME);
    
    // Compound index for guildId + userId
    await collection.createIndex({ guildId: 1, userId: 1 });
    
    // Index for guildId (for filtering all contributions)
    await collection.createIndex({ guildId: 1 });
    
    // Index for createdAt (for sorting)
    await collection.createIndex({ createdAt: -1 });
    
    console.log('[Contributions] Indexes initialized successfully');
  } catch (error) {
    console.error('[Contributions] Error initializing indexes:', error);
    throw error;
  }
}

/**
 * Record a contribution
 */
export async function recordContribution(guildId, userId, username, amount, message, reference) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const now = new Date();
  
  const contribution = {
    guildId,
    userId,
    username,
    amount,
    message,
    reference,
    createdAt: now
  };
  
  await collection.insertOne(contribution);
  return contribution;
}

/**
 * Get contributions with pagination
 */
export async function getContributionsPaginated(guildId, userId = null, page = 1, limit = 10) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const query = { guildId };
  if (userId) {
    query.userId = userId;
  }
  
  const skip = (page - 1) * limit;
  
  const contributions = await collection
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  
  const total = await collection.countDocuments(query);
  
  return {
    contributions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get contribution statistics
 */
export async function getContributionStats(guildId, userId = null) {
  const db = getDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  const query = { guildId };
  if (userId) {
    query.userId = userId;
  }
  
  const contributions = await collection.find(query).toArray();
  
  const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);
  const totalCount = contributions.length;
  
  return {
    totalAmount,
    totalCount
  };
}
