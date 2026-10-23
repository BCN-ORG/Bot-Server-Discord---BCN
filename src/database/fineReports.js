import { ObjectId } from 'mongodb';
import { getDatabase } from './mongodb.js';

const REPORTS_COLLECTION = 'fine_reports';
const ROLES_COLLECTION = 'fine_report_roles';
let indexesPromise;

function getReports() {
  return getDatabase().collection(REPORTS_COLLECTION);
}

function getRoles() {
  return getDatabase().collection(ROLES_COLLECTION);
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      getReports().createIndex({ guildId: 1, targetUserId: 1, createdAt: -1 }),
      getReports().createIndex({ guildId: 1, status: 1, createdAt: -1 }),
      getReports().createIndex({ guildId: 1, 'appeal.status': 1, 'appeal.appealedAt': -1 }),
      getRoles().createIndex({ guildId: 1, roleId: 1 }, { unique: true })
    ]).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }
  await indexesPromise;
}

export async function addFineReportRole(guildId, roleId, roleName, addedBy) {
  await ensureIndexes();
  return getRoles().updateOne(
    { guildId, roleId },
    {
      $set: { roleName, updatedAt: new Date(), updatedBy: addedBy },
      $setOnInsert: { createdAt: new Date(), addedBy }
    },
    { upsert: true }
  );
}

export async function removeFineReportRole(guildId, roleId) {
  await ensureIndexes();
  return getRoles().deleteOne({ guildId, roleId });
}

export async function getFineReportRoles(guildId) {
  await ensureIndexes();
  return getRoles().find({ guildId }).sort({ roleName: 1 }).toArray();
}

export async function createFineReport(report) {
  await ensureIndexes();
  const now = new Date();
  const document = {
    ...report,
    status: 'PENDING',
    createdAt: now,
    statusHistory: [{
      status: 'PENDING',
      changedBy: report.reporterUserId,
      changedAt: now,
      note: 'Biên bản được lập.'
    }]
  };
  const result = await getReports().insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function getFineReports(query, { limit = 15, skip = 0 } = {}) {
  await ensureIndexes();
  const [reports, totals] = await Promise.all([
    getReports()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    getReports().aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          recordedCoins: {
            $sum: { $cond: [{ $ne: ['$status', 'REJECTED'] }, '$amount', 0] }
          },
          pendingCoins: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, '$amount', 0] }
          }
        }
      }
    ]).toArray()
  ]);

  return {
    reports,
    totalCount: totals[0]?.count || 0,
    recordedCoins: totals[0]?.recordedCoins || 0,
    pendingCoins: totals[0]?.pendingCoins || 0
  };
}

export async function getFineReportById(guildId, reportId) {
  if (!ObjectId.isValid(reportId)) return null;
  return getReports().findOne({ _id: new ObjectId(reportId), guildId });
}

export async function submitFineReportAppeal({
  guildId,
  reportId,
  userId,
  statement
}) {
  await ensureIndexes();
  if (!ObjectId.isValid(reportId)) return null;

  const now = new Date();
  return getReports().findOneAndUpdate(
    {
      _id: new ObjectId(reportId),
      guildId,
      targetUserId: userId,
      appeal: { $exists: false }
    },
    {
      $set: {
        appeal: {
          appealedBy: userId,
          appealedAt: now,
          statement,
          status: 'PENDING'
        },
        updatedAt: now
      }
    },
    { returnDocument: 'after' }
  );
}

export async function getFineReportsWithAppeals(guildId, { limit = 10, skip = 0 } = {}) {
  await ensureIndexes();
  const query = { guildId, appeal: { $exists: true } };
  const [reports, totalCount] = await Promise.all([
    getReports()
      .find(query)
      .sort({ 'appeal.appealedAt': -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    getReports().countDocuments(query)
  ]);
  return { reports, totalCount };
}

export async function updateFineReportStatus({
  guildId,
  reportId,
  status,
  changedBy,
  note
}) {
  await ensureIndexes();
  if (!ObjectId.isValid(reportId)) return null;

  const now = new Date();
  const result = await getReports().findOneAndUpdate(
    { _id: new ObjectId(reportId), guildId },
    {
      $set: { status, updatedAt: now },
      $push: {
        statusHistory: {
          status,
          changedBy,
          changedAt: now,
          note: note || null
        }
      }
    },
    { returnDocument: 'after' }
  );
  return result;
}
