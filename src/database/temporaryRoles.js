import { ObjectId } from 'mongodb';
import { getDatabase } from './mongodb.js';

const SCHEDULES_COLLECTION = 'role_schedules';
const MEMBERS_COLLECTION = 'schedule_member_details';
let indexesPromise;

function getSchedules() {
  return getDatabase().collection(SCHEDULES_COLLECTION);
}

function getMembers() {
  return getDatabase().collection(MEMBERS_COLLECTION);
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      getSchedules().createIndex(
        { guildId: 1, groupRoleId: 1, targetRoleId: 1 },
        {
          unique: true,
          partialFilterExpression: { status: 'ACTIVE' }
        }
      ),
      getSchedules().createIndex({ status: 1, expireAt: 1 }),
      getMembers().createIndex({ sessionId: 1, userId: 1 }, { unique: true }),
      getMembers().createIndex({ sessionId: 1, status: 1 })
    ]).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }
  await indexesPromise;
}

export async function createOrUpdateRoleSchedule({
  guildId,
  groupRoleId,
  targetRoleId,
  durationDays
}) {
  await ensureIndexes();

  const now = new Date();
  const filter = {
    guildId,
    groupRoleId,
    targetRoleId,
    status: 'ACTIVE'
  };
  const update = {
    $set: {
      durationDays,
      expireAt: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000),
      updatedAt: now
    },
    $setOnInsert: { createdAt: now, totalMembers: 0 },
    $unset: { closingStatus: '' }
  };

  let created = false;
  try {
    const result = await getSchedules().updateOne(filter, update, { upsert: true });
    created = result.upsertedCount === 1;
  } catch (error) {
    if (error.code !== 11000) throw error;
    await getSchedules().updateOne(filter, update);
  }

  const schedule = await getSchedules().findOne(filter);
  if (!schedule) throw new Error('Không thể tạo hoặc cập nhật phiên role.');
  return { schedule, created };
}

export async function getActiveRoleSchedules() {
  await ensureIndexes();
  return getSchedules().find({ status: 'ACTIVE' }).toArray();
}

export async function getActiveRoleSchedulesForGuild(guildId) {
  await ensureIndexes();
  return getSchedules()
    .find({ guildId, status: 'ACTIVE' })
    .sort({ expireAt: 1 })
    .toArray();
}

export async function getActiveRoleScheduleById(sessionId, guildId) {
  await ensureIndexes();
  return getSchedules().findOne({
    _id: new ObjectId(sessionId),
    guildId,
    status: 'ACTIVE'
  });
}

export async function getRoleScheduleMembers(sessionId) {
  await ensureIndexes();
  return getMembers().find({ sessionId }).toArray();
}

export async function saveRoleScheduleMember(sessionId, userId, fields) {
  await ensureIndexes();
  const now = new Date();
  await getMembers().updateOne(
    { sessionId, userId },
    {
      $set: { ...fields, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
}

export async function countManagedRoleScheduleMembers(sessionId) {
  await ensureIndexes();
  return getMembers().countDocuments({
    sessionId,
    $or: [
      { status: { $in: ['ASSIGNED', 'PENDING_REVOKE'] } },
      { status: 'FAILED', operation: 'REVOKE' }
    ]
  });
}

export async function setRoleScheduleMemberCount(sessionId, totalMembers) {
  await ensureIndexes();
  await getSchedules().updateOne(
    { _id: sessionId, status: 'ACTIVE' },
    { $set: { totalMembers, updatedAt: new Date() } }
  );
}

export async function setRoleScheduleClosingStatus(sessionId, status) {
  await ensureIndexes();
  await getSchedules().updateOne(
    { _id: sessionId, status: 'ACTIVE', closingStatus: { $exists: false } },
    { $set: { closingStatus: status, updatedAt: new Date() } }
  );
}

export async function finishRoleSchedule(sessionId, status) {
  await ensureIndexes();
  await getSchedules().updateOne(
    { _id: sessionId, status: 'ACTIVE' },
    {
      $set: {
        status,
        completedAt: new Date(),
        updatedAt: new Date()
      },
      $unset: { closingStatus: '' }
    }
  );
}
