import { getDatabase } from './mongodb.js';

/**
 * Lay collection salary_coefficients
 */
function getSalaryCoefficientsCollection() {
  const db = getDatabase();
  return db.collection('salary_coefficients');
}

/**
 * Lay collection salary_eligible_roles
 */
function getSalaryEligibleRolesCollection() {
  const db = getDatabase();
  return db.collection('salary_eligible_roles');
}

/**
 * Lay collection salary_config
 */
function getSalaryConfigCollection() {
  const db = getDatabase();
  return db.collection('salary_config');
}

/**
 * Lay collection salary_history
 */
function getSalaryHistoryCollection() {
  const db = getDatabase();
  return db.collection('salary_history');
}

// ==================== SALARY COEFFICIENTS ====================

/**
 * Dat he so luong cho role
 * @param {string} roleId 
 * @param {string} roleName 
 * @param {number} coefficient 
 * @param {string} updatedBy 
 */
export async function setCoefficientForRole(roleId, roleName, coefficient, updatedBy) {
  try {
    const collection = getSalaryCoefficientsCollection();
    const result = await collection.updateOne(
      { roleId },
      { 
        $set: { 
          roleId,
          roleName,
          coefficient,
          updatedBy,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Set coefficient ${coefficient} for role ${roleName}`);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error setting coefficient:', error);
    throw error;
  }
}

/**
 * Lay he so luong cua role
 * @param {string} roleId 
 */
export async function getCoefficientByRole(roleId) {
  try {
    const collection = getSalaryCoefficientsCollection();
    const result = await collection.findOne({ roleId });
    return result;
  } catch (error) {
    console.error('[MongoDB] Error getting coefficient:', error);
    throw error;
  }
}

/**
 * Lay tat ca he so luong
 */
export async function getAllCoefficients() {
  try {
    const collection = getSalaryCoefficientsCollection();
    const coefficients = await collection.find({}).toArray();
    return coefficients;
  } catch (error) {
    console.error('[MongoDB] Error getting all coefficients:', error);
    throw error;
  }
}

/**
 * Xoa he so luong cua role
 * @param {string} roleId 
 */
export async function deleteCoefficientForRole(roleId) {
  try {
    const collection = getSalaryCoefficientsCollection();
    const result = await collection.deleteOne({ roleId });
    
    if (result.deletedCount > 0) {
      console.log(`[MongoDB] Deleted coefficient for role ${roleId}`);
    }
    
    return result.deletedCount > 0;
  } catch (error) {
    console.error('[MongoDB] Error deleting coefficient:', error);
    throw error;
  }
}

// ==================== ELIGIBLE ROLES ====================

/**
 * Them role vao danh sach duoc tra luong
 * @param {string} roleId 
 * @param {string} roleName 
 * @param {string} addedBy 
 */
export async function addEligibleRole(roleId, roleName, addedBy) {
  try {
    const collection = getSalaryEligibleRolesCollection();
    const result = await collection.updateOne(
      { roleId },
      { 
        $set: { 
          roleId,
          roleName,
          addedBy,
          addedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Added eligible role: ${roleName}`);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error adding eligible role:', error);
    throw error;
  }
}

/**
 * Xoa role khoi danh sach duoc tra luong
 * @param {string} roleId 
 */
export async function removeEligibleRole(roleId) {
  try {
    const collection = getSalaryEligibleRolesCollection();
    const result = await collection.deleteOne({ roleId });
    
    if (result.deletedCount > 0) {
      console.log(`[MongoDB] Removed eligible role: ${roleId}`);
    }
    
    return result.deletedCount > 0;
  } catch (error) {
    console.error('[MongoDB] Error removing eligible role:', error);
    throw error;
  }
}

/**
 * Lay tat ca role duoc tra luong
 */
export async function getAllEligibleRoles() {
  try {
    const collection = getSalaryEligibleRolesCollection();
    const roles = await collection.find({}).toArray();
    return roles;
  } catch (error) {
    console.error('[MongoDB] Error getting eligible roles:', error);
    throw error;
  }
}

// ==================== SCHEDULE CONFIG ====================

/**
 * Lay cau hinh lich tra luong
 */
export async function getSalaryConfig() {
  try {
    const collection = getSalaryConfigCollection();
    let config = await collection.findOne({ _id: 'schedule' });
    
    // Neu chua co config thi tao mac dinh
    if (!config) {
      config = {
        _id: 'schedule',
        dayOfWeek: 1, // Monday
        hour: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        updatedAt: new Date(),
        updatedBy: 'system'
      };
      
      await collection.insertOne(config);
      console.log('[MongoDB] Created default salary config');
    }
    
    return config;
  } catch (error) {
    console.error('[MongoDB] Error getting salary config:', error);
    throw error;
  }
}

/**
 * Cap nhat cau hinh lich tra luong
 * @param {number} dayOfWeek 
 * @param {number} hour 
 * @param {string} updatedBy 
 */
export async function updateSalaryConfig(dayOfWeek, hour, updatedBy) {
  try {
    const collection = getSalaryConfigCollection();
    const result = await collection.updateOne(
      { _id: 'schedule' },
      { 
        $set: { 
          dayOfWeek,
          hour,
          timezone: 'Asia/Ho_Chi_Minh',
          updatedBy,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Updated salary config: day=${dayOfWeek}, hour=${hour}`);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error updating salary config:', error);
    throw error;
  }
}

// ==================== PAYMENT HISTORY ====================

/**
 * Luu lich su tra luong
 * @param {Object} paymentData 
 */
export async function savePayrollHistory(paymentData) {
  try {
    const collection = getSalaryHistoryCollection();
    const record = {
      ...paymentData,
      createdAt: new Date()
    };
    
    const result = await collection.insertOne(record);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error saving payroll history:', error);
    throw error;
  }
}

/**
 * Lay lich su tra luong cua user
 * @param {string} guildId 
 * @param {string} userId 
 * @param {number} limit 
 */
export async function getHistoryByUser(guildId, userId, limit = 10) {
  try {
    const collection = getSalaryHistoryCollection();
    const history = await collection
      .find({ guildId, userId })
      .sort({ paidAt: -1 })
      .limit(limit)
      .toArray();
    
    return history;
  } catch (error) {
    console.error('[MongoDB] Error getting user history:', error);
    throw error;
  }
}

/**
 * Lay lich su tra luong theo thoi gian
 * @param {string} guildId 
 * @param {string} period 
 */
export async function getHistoryByPeriod(guildId, period) {
  try {
    const collection = getSalaryHistoryCollection();
    const history = await collection
      .find({ guildId, period })
      .sort({ paidAt: -1 })
      .toArray();
    
    return history;
  } catch (error) {
    console.error('[MongoDB] Error getting period history:', error);
    throw error;
  }
}
