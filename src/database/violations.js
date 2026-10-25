import { getDatabase } from './mongodb.js';

/**
 * Get violations collection
 */
function getViolationsCollection() {
  const db = getDatabase();
  return db.collection('violations');
}

/**
 * Get violation_config collection
 */
function getViolationConfigCollection() {
  const db = getDatabase();
  return db.collection('violation_config');
}

/**
 * Initialize indexes for violations and config collections
 */
export async function initViolationIndexes() {
  try {
    const violations = getViolationsCollection();
    const config = getViolationConfigCollection();

    // Drop old violations collection to start fresh (old data is incompatible)
    try {
      await violations.drop();
      console.log('[MongoDB] Dropped old violations collection');
    } catch (error) {
      // Collection doesn't exist yet, that's fine
    }

    // Create indexes for violations collection
    await violations.createIndex({ violationId: 1 }, { unique: true });
    await violations.createIndex({ userId: 1, isPaid: 1, createdAt: -1 });
    await violations.createIndex({ isPaid: 1, createdAt: -1 });
    await violations.createIndex({ guildId: 1 });

    // Create index for config collection
    await config.createIndex({ guildId: 1 }, { unique: true });

    console.log('[MongoDB] Violation indexes initialized');
  } catch (error) {
    console.error('[MongoDB] Error initializing violation indexes:', error);
    throw error;
  }
}

/**
 * Generate unique violation ID in format VIO-YYYYMMDD-XXX
 */
export async function generateViolationId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `VIO-${year}${month}${day}`;

  // Find the highest counter for today
  const collection = getViolationsCollection();
  const todayViolations = await collection
    .find({ violationId: new RegExp(`^${datePrefix}-`) })
    .sort({ violationId: -1 })
    .limit(1)
    .toArray();

  let counter = 1;
  if (todayViolations.length > 0) {
    const lastId = todayViolations[0].violationId;
    const lastCounter = parseInt(lastId.split('-')[2], 10);
    counter = lastCounter + 1;
  }

  const counterStr = String(counter).padStart(3, '0');
  return `${datePrefix}-${counterStr}`;
}

/**
 * Get guild config
 * @param {string} guildId 
 */
export async function getViolationConfig(guildId) {
  try {
    const collection = getViolationConfigCollection();
    const config = await collection.findOne({ guildId });

    if (!config) {
      // Create default config
      const defaultConfig = {
        guildId,
        authorizedRoles: [],
        reminderTimes: [{ hour: 9, minute: 0 }],
        announcementChannelId: null,
        updatedAt: new Date()
      };
      await collection.insertOne(defaultConfig);
      return defaultConfig;
    }

    return config;
  } catch (error) {
    console.error('[MongoDB] Error getting violation config:', error);
    throw error;
  }
}

/**
 * Upsert violation config
 * @param {string} guildId 
 * @param {Object} updates 
 */
export async function upsertViolationConfig(guildId, updates) {
  try {
    const collection = getViolationConfigCollection();
    const result = await collection.updateOne(
      { guildId },
      { $set: { ...updates, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log('[MongoDB] Updated violation config for guild', guildId);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error upserting violation config:', error);
    throw error;
  }
}

/**
 * Add authorized role
 * @param {string} guildId 
 * @param {string} roleId 
 */
export async function addAuthorizedRole(guildId, roleId) {
  try {
    const collection = getViolationConfigCollection();
    const config = await getViolationConfig(guildId);

    if (config.authorizedRoles.includes(roleId)) {
      return { success: false, message: 'Role đã có trong danh sách' };
    }

    await collection.updateOne(
      { guildId },
      { 
        $push: { authorizedRoles: roleId },
        $set: { updatedAt: new Date() }
      }
    );

    console.log('[MongoDB] Added authorized role', roleId, 'to guild', guildId);
    return { success: true };
  } catch (error) {
    console.error('[MongoDB] Error adding authorized role:', error);
    throw error;
  }
}

/**
 * Remove authorized role
 * @param {string} guildId 
 * @param {string} roleId 
 */
export async function removeAuthorizedRole(guildId, roleId) {
  try {
    const collection = getViolationConfigCollection();
    const result = await collection.updateOne(
      { guildId },
      { 
        $pull: { authorizedRoles: roleId },
        $set: { updatedAt: new Date() }
      }
    );

    console.log('[MongoDB] Removed authorized role', roleId, 'from guild', guildId);
    return { success: true };
  } catch (error) {
    console.error('[MongoDB] Error removing authorized role:', error);
    throw error;
  }
}

/**
 * Add reminder time (check for duplicates)
 * @param {string} guildId 
 * @param {number} hour 
 * @param {number} minute 
 */
export async function addReminderTime(guildId, hour, minute) {
  try {
    const collection = getViolationConfigCollection();
    const config = await getViolationConfig(guildId);

    // Check for duplicate
    const exists = config.reminderTimes.some(
      t => t.hour === hour && t.minute === minute
    );

    if (exists) {
      return { 
        success: false, 
        message: `Thời gian ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} đã tồn tại` 
      };
    }

    await collection.updateOne(
      { guildId },
      { 
        $push: { reminderTimes: { hour, minute } },
        $set: { updatedAt: new Date() }
      }
    );

    console.log('[MongoDB] Added reminder time', `${hour}:${minute}`, 'to guild', guildId);
    return { success: true };
  } catch (error) {
    console.error('[MongoDB] Error adding reminder time:', error);
    throw error;
  }
}

/**
 * Remove reminder time
 * @param {string} guildId 
 * @param {number} hour 
 * @param {number} minute 
 */
export async function removeReminderTime(guildId, hour, minute) {
  try {
    const collection = getViolationConfigCollection();
    const result = await collection.updateOne(
      { guildId },
      { 
        $pull: { reminderTimes: { hour, minute } },
        $set: { updatedAt: new Date() }
      }
    );

    console.log('[MongoDB] Removed reminder time', `${hour}:${minute}`, 'from guild', guildId);
    return { success: true };
  } catch (error) {
    console.error('[MongoDB] Error removing reminder time:', error);
    throw error;
  }
}

/**
 * Set announcement channel
 * @param {string} guildId 
 * @param {string} channelId 
 */
export async function setAnnouncementChannel(guildId, channelId) {
  try {
    const collection = getViolationConfigCollection();
    await collection.updateOne(
      { guildId },
      { 
        $set: { 
          announcementChannelId: channelId,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log('[MongoDB] Set announcement channel', channelId, 'for guild', guildId);
    return { success: true };
  } catch (error) {
    console.error('[MongoDB] Error setting announcement channel:', error);
    throw error;
  }
}

/**
 * Create violation
 * @param {Object} params
 * @param {string} params.userId - Discord user ID
 * @param {string} params.username - Username at creation
 * @param {string} params.reason - Reason for violation
 * @param {number} params.amount - Amount to pay
 * @param {string} params.createdBy - User ID who created
 * @param {string} params.guildId - Guild ID
 */
export async function createViolation({ userId, username, reason, amount, createdBy, guildId }) {
  try {
    const collection = getViolationsCollection();
    const violationId = await generateViolationId();
    const now = new Date();

    const violation = {
      violationId,
      userId,
      username,
      reason,
      amount,
      isPaid: false,
      paidAt: null,
      paidBy: null,
      payrollReference: null,
      createdBy,
      guildId,
      createdAt: now,
      updatedAt: now
    };

    await collection.insertOne(violation);
    console.log('[MongoDB] Created violation', violationId, 'for user', userId);

    return violation;
  } catch (error) {
    console.error('[MongoDB] Error creating violation:', error);
    throw error;
  }
}

/**
 * Get violation by ID
 * @param {string} violationId 
 */
export async function getViolationById(violationId) {
  try {
    const collection = getViolationsCollection();
    const violation = await collection.findOne({ violationId });
    return violation;
  } catch (error) {
    console.error('[MongoDB] Error getting violation by ID:', error);
    throw error;
  }
}

/**
 * Get violations by user
 * @param {string} userId 
 * @param {boolean|null} isPaid - null for all, true for paid, false for unpaid
 */
export async function getViolationsByUser(userId, isPaid = null) {
  try {
    const collection = getViolationsCollection();
    const query = { userId };
    
    if (isPaid !== null) {
      query.isPaid = isPaid;
    }

    const violations = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return violations;
  } catch (error) {
    console.error('[MongoDB] Error getting violations by user:', error);
    throw error;
  }
}

/**
 * Get all violations with filters
 * @param {string} guildId 
 * @param {Object} filters 
 */
export async function getAllViolations(guildId, filters = {}) {
  try {
    const collection = getViolationsCollection();
    const query = { guildId, ...filters };

    const violations = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return violations;
  } catch (error) {
    console.error('[MongoDB] Error getting all violations:', error);
    throw error;
  }
}

/**
 * Mark violation as paid
 * @param {string} violationId 
 * @param {string} paidBy - User ID who paid
 * @param {string} payrollReference - Reference from Payroll API
 */
export async function markViolationPaid(violationId, paidBy, payrollReference) {
  try {
    const collection = getViolationsCollection();
    const result = await collection.updateOne(
      { violationId },
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

    if (result.modifiedCount > 0) {
      console.log('[MongoDB] Marked violation', violationId, 'as paid by', paidBy);
    }

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('[MongoDB] Error marking violation as paid:', error);
    throw error;
  }
}

/**
 * Get all unpaid violations for a guild
 * @param {string} guildId 
 */
export async function getUnpaidViolations(guildId) {
  try {
    const collection = getViolationsCollection();
    const violations = await collection
      .find({ guildId, isPaid: false })
      .sort({ createdAt: -1 })
      .toArray();

    return violations;
  } catch (error) {
    console.error('[MongoDB] Error getting unpaid violations:', error);
    throw error;
  }
}
