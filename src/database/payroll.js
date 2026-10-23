import { getDatabase } from './mongodb.js';

/**
 * Lay collection salary_coefficients
 */
function getSalaryCoefficientsCollection() {
  const db = getDatabase();
  return db.collection('salary_coefficients');
}

/**
 * Lay collection salary_simple_roles
 */
function getSalarySimpleRolesCollection() {
  const db = getDatabase();
  return db.collection('salary_simple_roles');
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

/**
 * Lay collection salary_notification_config
 */
function getSalaryNotificationConfigCollection() {
  const db = getDatabase();
  return db.collection('salary_notification_config');
}

/**
 * Lay collection salary_debts
 */
function getSalaryDebtsCollection() {
  const db = getDatabase();
  return db.collection('salary_debts');
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

// ==================== FIXED ROLE SALARIES ====================

/**
 * Dat luong co dinh cho role
 * @param {string} roleId
 * @param {string} roleName
 * @param {number} amount
 * @param {string} updatedBy
 */
export async function setSimpleSalaryForRole(roleId, roleName, amount, updatedBy) {
  try {
    const collection = getSalarySimpleRolesCollection();
    const result = await collection.updateOne(
      { roleId },
      {
        $set: {
          roleId,
          roleName,
          amount,
          updatedBy,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Set fixed salary ${amount} for role ${roleName}`);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error setting fixed role salary:', error);
    throw error;
  }
}

/**
 * Lay luong co dinh cua role
 * @param {string} roleId
 */
export async function getSimpleSalaryByRole(roleId) {
  try {
    return await getSalarySimpleRolesCollection().findOne({ roleId });
  } catch (error) {
    console.error('[MongoDB] Error getting fixed role salary:', error);
    throw error;
  }
}

/**
 * Lay tat ca luong co dinh theo role
 */
export async function getAllSimpleRoleSalaries() {
  try {
    return await getSalarySimpleRolesCollection().find({}).toArray();
  } catch (error) {
    console.error('[MongoDB] Error getting fixed role salaries:', error);
    throw error;
  }
}

/**
 * Xoa luong co dinh cua role
 * @param {string} roleId
 */
export async function deleteSimpleSalaryForRole(roleId) {
  try {
    const result = await getSalarySimpleRolesCollection().deleteOne({ roleId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('[MongoDB] Error deleting fixed role salary:', error);
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
        minute: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        updatedAt: new Date(),
        updatedBy: 'system'
      };
      
      await collection.insertOne(config);
      console.log('[MongoDB] Created default salary config');
    }
    
    // Them minute mac dinh neu chua co
    if (config.minute === undefined) {
      config.minute = 0;
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
 * @param {number} minute 
 * @param {string} updatedBy 
 */
export async function updateSalaryConfig(dayOfWeek, hour, minute, updatedBy) {
  try {
    const collection = getSalaryConfigCollection();
    const result = await collection.updateOne(
      { _id: 'schedule' },
      { 
        $set: { 
          dayOfWeek,
          hour,
          minute,
          timezone: 'Asia/Ho_Chi_Minh',
          updatedBy,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Updated salary config: day=${dayOfWeek}, hour=${hour}, minute=${minute}`);
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

// ==================== NOTIFICATION CONFIG ====================

/**
 * Lay cau hinh thong bao luong
 */
export async function getSalaryNotificationConfig() {
  try {
    const collection = getSalaryNotificationConfigCollection();
    let config = await collection.findOne({ _id: 'notification_schedule' });
    
    // Neu chua co config thi tao mac dinh
    if (!config) {
      config = {
        _id: 'notification_schedule',
        dayOfWeek: 0, // Sunday (1 day before Monday payout)
        hour: 20,
        minute: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        notificationRoles: [],
        updatedAt: new Date(),
        updatedBy: 'system'
      };
      
      await collection.insertOne(config);
      console.log('[MongoDB] Created default notification config');
    }
    
    return config;
  } catch (error) {
    console.error('[MongoDB] Error getting notification config:', error);
    throw error;
  }
}

/**
 * Cap nhat cau hinh thong bao luong
 * @param {number} dayOfWeek 
 * @param {number} hour 
 * @param {number} minute 
 * @param {Array} notificationRoles 
 * @param {string} updatedBy 
 */
export async function updateSalaryNotificationConfig(dayOfWeek, hour, minute, notificationRoles, updatedBy) {
  try {
    const collection = getSalaryNotificationConfigCollection();
    const result = await collection.updateOne(
      { _id: 'notification_schedule' },
      { 
        $set: { 
          dayOfWeek,
          hour,
          minute,
          timezone: 'Asia/Ho_Chi_Minh',
          notificationRoles,
          updatedBy,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Updated notification config: day=${dayOfWeek}, hour=${hour}, minute=${minute}`);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error updating notification config:', error);
    throw error;
  }
}

// ==================== DEBTS ====================

/**
 * Tao ban ghi no luong
 * @param {Object} debtRecord 
 */
export async function createDebt(debtRecord) {
  try {
    const collection = getSalaryDebtsCollection();
    const result = await collection.insertOne({
      ...debtRecord,
      createdAt: new Date()
    });
    
    console.log(`[MongoDB] Created debt record: ${debtRecord.debtId}`);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error creating debt:', error);
    throw error;
  }
}

/**
 * Lay thong tin no theo ID
 * @param {string} debtId 
 */
export async function getDebtById(debtId) {
  try {
    const collection = getSalaryDebtsCollection();
    const debt = await collection.findOne({ debtId });
    return debt;
  } catch (error) {
    console.error('[MongoDB] Error getting debt by ID:', error);
    throw error;
  }
}

/**
 * Lay tat ca cac ban ghi no
 * @param {Object} filters 
 */
export async function getAllDebts(filters = {}) {
  try {
    const collection = getSalaryDebtsCollection();
    const debts = await collection
      .find(filters)
      .sort({ createdAt: -1 })
      .toArray();
    
    return debts;
  } catch (error) {
    console.error('[MongoDB] Error getting all debts:', error);
    throw error;
  }
}

/**
 * Cap nhat trang thai no
 * @param {string} debtId 
 * @param {string} status 
 * @param {Date} paidAt 
 */
export async function updateDebtStatus(debtId, status, paidAt) {
  try {
    const collection = getSalaryDebtsCollection();
    const result = await collection.updateOne(
      { debtId },
      { 
        $set: { 
          status,
          paidAt,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`[MongoDB] Updated debt ${debtId} status to ${status}`);
    return result;
  } catch (error) {
    console.error('[MongoDB] Error updating debt status:', error);
    throw error;
  }
}
