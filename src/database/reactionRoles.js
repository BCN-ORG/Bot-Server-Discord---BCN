import { getDatabase } from './mongodb.js';

const COLLECTION_NAME = 'reaction_role_configs';
let indexPromise;

function getCollection() {
  return getDatabase().collection(COLLECTION_NAME);
}

async function ensureIndexes() {
  if (!indexPromise) {
    indexPromise = getCollection()
      .createIndex({ guildId: 1, messageId: 1, roleId: 1 }, { unique: true })
      .then(() => getCollection().createIndex({ 'claimants.expireAt': 1 }))
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  await indexPromise;
}

export async function saveReactionRoleConfig(config) {
  await ensureIndexes();
  const now = new Date();

  await getCollection().updateOne(
    {
      guildId: config.guildId,
      messageId: config.messageId,
      roleId: config.roleId
    },
    {
      $set: {
        channelId: config.channelId,
        emojiKey: config.emojiKey,
        emojiLabel: config.emojiLabel,
        limit: config.limit,
        durationDays: config.durationDays ?? null,
        every: config.every ?? null,
        updatedAt: now
      },
      $setOnInsert: {
        claimants: [],
        createdAt: now
      }
    },
    { upsert: true }
  );
}

export async function getReactionRoleConfig(guildId, messageId, roleId) {
  return getCollection().findOne({ guildId, messageId, roleId });
}

export async function getReactionRoleConfigsForMessage(guildId, messageId) {
  return getCollection().find({ guildId, messageId }).toArray();
}

export async function getReactionRoleConfigsForGuild(guildId) {
  return getCollection().find({ guildId }).sort({ messageId: 1, roleId: 1 }).toArray();
}

export async function getExpiredReactionRoleClaims(now = new Date()) {
  const configs = await getCollection()
    .find({ 'claimants.expireAt': { $lte: now } })
    .toArray();
  return configs.flatMap(config => (
    (config.claimants || [])
      .filter(claimant => claimant.expireAt && claimant.expireAt <= now)
      .map(claimant => ({ ...config, claimant }))
  ));
}

export async function removeExpiredReactionRoleClaim(config, userId, now = new Date()) {
  const result = await getCollection().updateOne(
    {
      guildId: config.guildId,
      messageId: config.messageId,
      roleId: config.roleId
    },
    {
      $pull: {
        claimants: {
          userId,
          expireAt: { $lte: now }
        }
      }
    }
  );
  return result.modifiedCount === 1;
}

export async function tryAddReactionRoleClaim(config, claimant) {
  const result = await getCollection().updateOne(
    {
      guildId: config.guildId,
      messageId: config.messageId,
      roleId: config.roleId,
      'claimants.userId': { $ne: claimant.userId },
      $expr: {
        $lt: [
          { $size: { $ifNull: ['$claimants', []] } },
          '$limit'
        ]
      }
    },
    {
      $push: { claimants: claimant }
    }
  );

  return result.modifiedCount === 1;
}

export async function addReactionRoleClaimEmoji(config, userId, emojiKey) {
  await getCollection().updateOne(
    {
      guildId: config.guildId,
      messageId: config.messageId,
      roleId: config.roleId,
      'claimants.userId': userId
    },
    {
      $addToSet: { 'claimants.$.emojiKeys': emojiKey }
    }
  );
}

export async function removeReactionRoleClaimEmoji(config, userId, emojiKey) {
  const collection = getCollection();
  const query = {
    guildId: config.guildId,
    messageId: config.messageId,
    roleId: config.roleId
  };
  const before = await collection.findOne({
    ...query,
    'claimants.userId': userId
  });
  const claimant = before?.claimants?.find(claim => claim.userId === userId);
  if (!claimant) return null;

  await collection.updateOne(
    { ...query, 'claimants.userId': userId },
    { $pull: { 'claimants.$.emojiKeys': emojiKey } }
  );

  const updated = await collection.findOne({ ...query, 'claimants.userId': userId });
  const updatedClaimant = updated?.claimants?.find(claim => claim.userId === userId);
  if (updatedClaimant?.emojiKeys?.length) return null;

  return { ...claimant, emojiKeys: [] };
}

export async function removeReactionRoleClaim(config, userId) {
  await getCollection().updateOne(
    {
      guildId: config.guildId,
      messageId: config.messageId,
      roleId: config.roleId
    },
    { $pull: { claimants: { userId } } }
  );
}

export async function getReactionRoleClaimsForRole(guildId, roleId, userId = null) {
  const query = { guildId, roleId, 'claimants.0': { $exists: true } };
  if (userId) query['claimants.userId'] = userId;
  const configs = await getCollection()
    .find(query)
    .toArray();

  return configs.flatMap(config => (
    config.claimants
      .filter(claimant => !userId || claimant.userId === userId)
      .map(claimant => ({
      ...claimant,
      messageId: config.messageId
      }))
  ));
}

export async function setReactionRoleClaimsPreExisting(guildId, roleId, userId, preExisting) {
  await getCollection().updateMany(
    { guildId, roleId, 'claimants.userId': userId },
    { $set: { 'claimants.$[claim].roleWasPreexisting': preExisting } },
    { arrayFilters: [{ 'claim.userId': userId }] }
  );
}

export async function deleteReactionRoleConfig(guildId, messageId, roleId) {
  return getCollection().deleteOne({ guildId, messageId, roleId });
}

export async function getScheduledReactionRoleConfigs(currentTime) {
  return getCollection()
    .find({
      every: currentTime,
      'claimants.0': { $exists: true }
    })
    .toArray();
}
