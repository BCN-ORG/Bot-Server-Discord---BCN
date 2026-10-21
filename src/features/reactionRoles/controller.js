import { PermissionFlagsBits } from 'discord.js';
import {
  addReactionRoleClaimEmoji,
  deleteReactionRoleConfig,
  getReactionRoleClaimsForRole,
  getReactionRoleConfig,
  getReactionRoleConfigsForGuild,
  getReactionRoleConfigsForMessage,
  removeReactionRoleClaim,
  removeReactionRoleClaimsForMember,
  saveReactionRoleConfig,
  setReactionRoleClaimsPreExisting,
  tryAddReactionRoleClaim
} from '../../database/reactionRoles.js';

const snowflakePattern = /^\d{17,20}$/;
const locks = new Map();

async function withRoleLock(key, action) {
  const previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => {
    release = resolve;
  });
  locks.set(key, current);

  await previous;
  try {
    return await action();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}

function roleLockKey(guildId, roleId) {
  return `${guildId}:${roleId}`;
}

function normalizeEmoji(input) {
  const value = input.trim();
  if (!value) throw new Error('Emoji không được để trống.');
  if (value.toLowerCase() === 'all') {
    return { emojiKey: 'all', emojiLabel: 'all' };
  }

  const customEmoji = value.match(/^<a?:[A-Za-z0-9_]+:(\d{17,20})>$/);
  const customEmojiId = value.match(/^\d{17,20}$/);
  const emojiKey = customEmoji?.[1] || customEmojiId?.[0] || value;
  return { emojiKey, emojiLabel: value };
}

function getReactionEmojiKey(reaction) {
  return reaction.emoji.id || reaction.emoji.name;
}

async function fetchReactionContext(reaction, user) {
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();
  if (user.partial) await user.fetch();

  const { message } = reaction;
  if (!message.guild || user.bot) return null;
  return { message, guild: message.guild };
}

async function ensureMemberRole(member, role) {
  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role, 'Reaction role claim');
  }
}

async function processReactionAdd(config, reaction, member) {
  const emojiKey = getReactionEmojiKey(reaction);
  const currentConfig = await getReactionRoleConfig(
    config.guildId,
    config.messageId,
    config.roleId
  );
  if (!currentConfig) return;

  const existingClaim = currentConfig.claimants?.find(claim => claim.userId === member.id);
  if (existingClaim) {
    const claims = await getReactionRoleClaimsForRole(config.guildId, config.roleId, member.id);
    const preExisting = member.roles.cache.has(config.roleId)
      ? claims[0]?.roleWasPreexisting ?? existingClaim.roleWasPreexisting
      : false;
    await setReactionRoleClaimsPreExisting(
      config.guildId,
      config.roleId,
      member.id,
      preExisting
    );
    const refreshedConfig = await getReactionRoleConfig(
      config.guildId,
      config.messageId,
      config.roleId
    );
    if (!refreshedConfig) return false;
    await addReactionRoleClaimEmoji(refreshedConfig, member.id, emojiKey);
    await ensureMemberRole(member, config.role);
    return false;
  }

  const existingRoleClaims = await getReactionRoleClaimsForRole(
    config.guildId,
    config.roleId,
    member.id
  );
  const roleWasPreexisting = member.roles.cache.has(config.roleId)
    ? existingRoleClaims[0]?.roleWasPreexisting ?? true
    : false;

  const added = await tryAddReactionRoleClaim(currentConfig, {
    userId: member.id,
    emojiKeys: [emojiKey],
    roleWasPreexisting
  });

  if (!added) {
    const latestConfig = await getReactionRoleConfig(
      config.guildId,
      config.messageId,
      config.roleId
    );
    const concurrentlyAddedClaim = latestConfig?.claimants?.find(
      claim => claim.userId === member.id
    );
    if (concurrentlyAddedClaim) {
      await addReactionRoleClaimEmoji(latestConfig, member.id, emojiKey);
      await ensureMemberRole(member, config.role);
      return false;
    }

    if (!latestConfig) return false;
    await reaction.users.remove(member.id);
    console.info(
      `[INFO] Reaction role limit reached for message ${config.messageId}, role ${config.roleId}`
    );
    return true;
  }

  try {
    await setReactionRoleClaimsPreExisting(
      config.guildId,
      config.roleId,
      member.id,
      roleWasPreexisting
    );
    await ensureMemberRole(member, config.role);
  } catch (error) {
    await removeReactionRoleClaim(currentConfig, member.id);
    throw error;
  }
  return false;
}

async function processReactionRemove(config, reaction, member) {
  const emojiKey = getReactionEmojiKey(reaction);
  const currentConfig = await getReactionRoleConfig(
    config.guildId,
    config.messageId,
    config.roleId
  );
  if (!currentConfig) return;

  const claimant = currentConfig.claimants?.find(claim => claim.userId === member.id);
  if (!claimant?.emojiKeys?.includes(emojiKey)) return;

  const removedClaim = await removeReactionRoleClaimEmoji(currentConfig, member.id, emojiKey);
  if (!removedClaim) return;

  const remainingClaims = await getReactionRoleClaimsForRole(
    config.guildId,
    config.roleId,
    member.id
  );
  const otherClaims = remainingClaims.filter(claim => claim.messageId !== config.messageId);
  if (otherClaims.length || removedClaim.roleWasPreexisting) {
    await removeReactionRoleClaim(currentConfig, member.id);
    return;
  }

  if (member.roles.cache.has(config.roleId)) {
    await member.roles.remove(config.roleId, 'Reaction role reaction removed');
  }
  await removeReactionRoleClaim(currentConfig, member.id);
}

export async function handleReactionRoleAdd(reaction, user) {
  try {
    const context = await fetchReactionContext(reaction, user);
    if (!context) return;

    const emojiKey = getReactionEmojiKey(reaction);
    const configs = await getReactionRoleConfigsForMessage(
      context.guild.id,
      context.message.id
    );
    const matchingConfigs = configs.filter(config => (
      config.emojiKey === 'all' || config.emojiKey === emojiKey
    ));

    if (!matchingConfigs.length) return;
    const member = await context.guild.members.fetch(user.id);

    for (const config of matchingConfigs) {
      const rejected = await withRoleLock(roleLockKey(config.guildId, config.roleId), async () => {
        const role = await context.guild.roles.fetch(config.roleId);
        if (!role) {
          console.error(
            `[ERROR] Reaction role ${config.roleId} no longer exists (message ${config.messageId})`
          );
          return false;
        }
        return processReactionAdd({ ...config, role }, reaction, member);
      });
      if (rejected) return;
    }
  } catch (error) {
    console.error('[ERROR] Failed to process reaction role add:', error);
  }
}

export async function handleReactionRoleRemove(reaction, user) {
  try {
    const context = await fetchReactionContext(reaction, user);
    if (!context) return;

    const emojiKey = getReactionEmojiKey(reaction);
    const configs = await getReactionRoleConfigsForMessage(
      context.guild.id,
      context.message.id
    );
    const matchingConfigs = configs.filter(config => (
      config.emojiKey === 'all'
      || config.emojiKey === emojiKey
      || config.claimants?.some(claim => (
        claim.userId === user.id && claim.emojiKeys?.includes(emojiKey)
      ))
    ));
    if (!matchingConfigs.length) return;

    const member = await context.guild.members.fetch(user.id);
    for (const config of matchingConfigs) {
      await withRoleLock(roleLockKey(config.guildId, config.roleId), async () => {
        await processReactionRemove(config, reaction, member);
      });
    }
  } catch (error) {
    console.error('[ERROR] Failed to process reaction role remove:', error);
  }
}

export async function setConfig({ guild, channel, messageId, role, limit, emoji }) {
  if (!snowflakePattern.test(messageId)) {
    throw new Error('Message ID không hợp lệ.');
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Limit phải là số nguyên dương.');
  }
  if (channel.guildId !== guild.id) {
    throw new Error('Kênh phải thuộc server hiện tại.');
  }
  if (role.guild.id !== guild.id || role.id === guild.id || role.managed) {
    throw new Error('Role không hợp lệ hoặc không thể cấp bởi bot.');
  }

  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !role.editable) {
    throw new Error('Bot cần quyền Manage Roles và role phải thấp hơn role cao nhất của bot.');
  }
  const channelPermissions = channel.permissionsFor(botMember);
  if (!channelPermissions?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages
  ])) {
    throw new Error('Bot cần quyền xem kênh, đọc lịch sử tin nhắn và quản lý tin nhắn trong kênh.');
  }

  const message = await channel.messages.fetch(messageId);
  const { emojiKey, emojiLabel } = normalizeEmoji(emoji);
  await saveReactionRoleConfig({
    guildId: guild.id,
    channelId: channel.id,
    messageId,
    roleId: role.id,
    emojiKey,
    emojiLabel,
    limit
  });

  return `Đã lưu cấu hình: ${role} trên tin nhắn \`${message.id}\`, ` +
    `emoji \`${emojiLabel}\`, giới hạn **${limit}** thành viên.`;
}

export async function deleteConfig(guild, messageId, roleId) {
  if (!snowflakePattern.test(messageId)) {
    throw new Error('Message ID không hợp lệ.');
  }
  const config = await getReactionRoleConfig(guild.id, messageId, roleId);
  if (!config) return false;

  return withRoleLock(roleLockKey(guild.id, roleId), async () => {
    let role = guild.roles.cache.get(roleId);
    if (!role) {
      try {
        role = await guild.roles.fetch(roleId);
      } catch (error) {
        if (error.code !== 10011) throw error;
      }
    }
    for (const claimant of config.claimants || []) {
      const otherClaims = await getReactionRoleClaimsForRole(guild.id, roleId, claimant.userId);
      const remainingClaims = otherClaims.filter(claim => (
        claim.userId === claimant.userId && claim.messageId !== messageId
      ));
      if (remainingClaims.length || claimant.roleWasPreexisting || !role) continue;

      try {
        const member = await guild.members.fetch(claimant.userId);
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'Reaction role configuration removed');
        }
      } catch (error) {
        if (error.code !== 10007) throw error;
      }
    }

    await deleteReactionRoleConfig(guild.id, messageId, roleId);
    return true;
  });
}

export async function listConfigs(guildId) {
  return getReactionRoleConfigsForGuild(guildId);
}

export async function handleReactionRoleMemberRemove(member) {
  try {
    await removeReactionRoleClaimsForMember(member.guild.id, member.id);
  } catch (error) {
    console.error(
      `[ERROR] Failed to release reaction role claims for member ${member.id}:`,
      error
    );
  }
}
