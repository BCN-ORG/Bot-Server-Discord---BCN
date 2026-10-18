import { getDatabase } from './mongodb.js';

export const ViolationStatus = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  KICKED: 'kicked'
};

/**
 * Lấy collection violations
 */
function getViolationsCollection() {
  const db = getDatabase();
  return db.collection('violations');
}

/**
 * Tạo vi phạm mới
 * @param {string} guildId 
 * @param {string} memberId 
 * @param {string} invalidNickname 
 */
export async function createViolation(guildId, memberId, invalidNickname) {
  try {
    const collection = getViolationsCollection();
    const now = new Date();
    const deadlineAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 giờ

    const violation = {
      guildId,
      memberId,
      invalidNickname,
      notifiedAt: now,
      deadlineAt,
      status: ViolationStatus.PENDING,
      createdAt: now,
      updatedAt: now
    };

    const result = await collection.insertOne(violation);
    console.log(`[MongoDB] Created violation for member ${memberId}`);
    
    return { id: result.insertedId, ...violation };
  } catch (error) {
    console.error('[MongoDB] Error creating violation:', error);
    throw error;
  }
}

/**
 * Lấy thông tin vi phạm của member
 * @param {string} guildId 
 * @param {string} memberId 
 */
export async function getViolation(guildId, memberId) {
  try {
    const collection = getViolationsCollection();
    const violation = await collection.findOne({ 
      guildId, 
      memberId,
      status: ViolationStatus.PENDING 
    });

    return violation;
  } catch (error) {
    console.error('[MongoDB] Error getting violation:', error);
    throw error;
  }
}

/**
 * Cập nhật nickname trong vi phạm (không reset deadline)
 * @param {string} guildId 
 * @param {string} memberId 
 * @param {string} newNickname 
 */
export async function updateViolationNickname(guildId, memberId, newNickname) {
  try {
    const collection = getViolationsCollection();
    const result = await collection.updateOne(
      { guildId, memberId, status: ViolationStatus.PENDING },
      { 
        $set: { 
          invalidNickname: newNickname,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[MongoDB] Updated violation nickname for member ${memberId}`);
    }

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('[MongoDB] Error updating violation nickname:', error);
    throw error;
  }
}

/**
 * Đóng vi phạm khi member đã đổi tên hợp lệ
 * @param {string} guildId 
 * @param {string} memberId 
 */
export async function resolveViolation(guildId, memberId) {
  try {
    const collection = getViolationsCollection();
    const result = await collection.updateOne(
      { guildId, memberId, status: ViolationStatus.PENDING },
      { 
        $set: { 
          status: ViolationStatus.RESOLVED,
          resolvedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[MongoDB] Resolved violation for member ${memberId}`);
    }

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('[MongoDB] Error resolving violation:', error);
    throw error;
  }
}

/**
 * Lấy danh sách vi phạm quá hạn
 */
export async function getOverdueViolations() {
  try {
    const collection = getViolationsCollection();
    const now = new Date();
    
    const violations = await collection
      .find({
        status: ViolationStatus.PENDING,
        deadlineAt: { $lte: now }
      })
      .toArray();

    return violations;
  } catch (error) {
    console.error('[MongoDB] Error getting overdue violations:', error);
    throw error;
  }
}

/**
 * Đánh dấu vi phạm đã bị kick
 * @param {string} guildId 
 * @param {string} memberId 
 */
export async function markViolationAsKicked(guildId, memberId) {
  try {
    const collection = getViolationsCollection();
    const result = await collection.updateOne(
      { guildId, memberId, status: ViolationStatus.PENDING },
      { 
        $set: { 
          status: ViolationStatus.KICKED,
          kickedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[MongoDB] Marked violation as kicked for member ${memberId}`);
    }

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('[MongoDB] Error marking violation as kicked:', error);
    throw error;
  }
}
