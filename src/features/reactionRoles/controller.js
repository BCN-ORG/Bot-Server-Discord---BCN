import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  addReactionRoleClaimEmoji,
  deleteReactionRoleConfig,
  getReactionRoleClaimsForRole,
  getReactionRoleConfig,
  getReactionRoleConfigsForGuild,
  getReactionRoleConfigsForMessage,
  getExpiredReactionRoleClaims,
  getScheduledReactionRoleConfigs,
  removeExpiredReactionRoleClaim,
  removeReactionRoleClaim,
  removeReactionRoleClaimsForMember,
  saveReactionRoleConfig,
  setReactionRoleClaimsPreExisting,
  tryAddReactionRoleClaim
} from '../../database/reactionRoles.js';
import { chargeCoins } from '../payroll/services/apiClient.js';

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

function isClaimActive(claim, now = new Date()) {
  return !claim.expireAt || claim.expireAt > now;
}

function getClaimExpireAt(durationDays) {
  if (!durationDays) return null;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

function parseEveryTime(every) {
  if (!every) return null;
  const match = every.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error('Format giờ không hợp lệ. Dùng HH:mm (ví dụ: 08:20)');
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Giờ phải từ 00:00 đến 23:59');
  }
  return { hours, minutes };
}

function normalizeEmoji(input) {
  const value = input.trim();
  if (!value) throw new Error('Emoji không được để trống.');

  const customEmoji = value.match(/^<a?:[A-Za-z0-9_]+:(\d{17,20})>$/);
  const customEmojiId = value.match(/^\d{17,20}$/);
  const emojiKey = customEmoji?.[1] || customEmojiId?.[0] || value;
  return { emojiKey, emojiLabel: value };
}

function getReactionEmojiKey(reaction) {
  return reaction.emoji.id || reaction.emoji.name;
}

function matchesReactionEmoji(config, emojiKey) {
  return config.emojiKey === emojiKey;
}

async function sendRoleNotification(
  member,
  role,
  guild,
  action,
  reason,
  expireAt = null,
  durationDays = null,
  every = null
) {
  const isGranted = action === 'granted';
  const roleName = role?.name || `ID ${role?.id || 'không xác định'}`;

  try {
    const embed = new EmbedBuilder()
      .setColor(isGranted ? '#2ecc71' : '#e74c3c')
      .setTitle(isGranted ? 'Bạn đã nhận role' : 'Role đã được thu hồi')
      .setDescription(
        isGranted
          ? `Bạn đã nhận role **${roleName}** trong máy chủ **${guild.name}**.`
          : `Role **${roleName}** đã được thu hồi trong máy chủ **${guild.name}**.`
      )
      .addFields({ name: 'Lý do', value: reason });

    if (isGranted) {
      let durationText = 'Không thời hạn';
      if (durationDays) durationText = `${durationDays} ngày`;
      else if (every) durationText = `Gỡ tự động mỗi ngày lúc ${every}`;
      
      embed.addFields({
        name: 'Thời gian sử dụng role',
        value: durationText
      });
      
      // Chỉ hiển thị expireAt khi dùng duration (hook), không hiển thị với every (schedule)
      if (expireAt && durationDays) {
        embed.addFields({
          name: 'Thời điểm hết hạn',
          value: `<t:${Math.floor(expireAt.getTime() / 1000)}:F>`
        });
      }
    }
    embed.setTimestamp();
    await member.user.send({ embeds: [embed] });
  } catch (error) {
    if (error.code === 50007) {
      console.warn(
        `[WARN] Could not DM member ${member.id} about reaction role ${role?.id || 'unknown'}: DMs are disabled`
      );
      return;
    }
    console.error(
      `[ERROR] Failed to DM member ${member.id} about reaction role ${role?.id || 'unknown'}:`,
      error
    );
  }
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
    return true;
  }
  return false;
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
    const newlyGranted = await ensureMemberRole(member, config.role);
    if (newlyGranted) {
      await sendRoleNotification(
        member,
        config.role,
        member.guild,
        'granted',
        'Bạn đã đăng ký nhận role bằng reaction.',
        existingClaim.expireAt,
        refreshedConfig.durationDays,
        refreshedConfig.every
      );
    }
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

  const expireAt = getClaimExpireAt(currentConfig.durationDays);
  const added = await tryAddReactionRoleClaim(currentConfig, {
    userId: member.id,
    emojiKeys: [emojiKey],
    roleWasPreexisting,
    expireAt
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
      const newlyGranted = await ensureMemberRole(member, config.role);
      if (newlyGranted) {
        await sendRoleNotification(
          member,
          config.role,
          member.guild,
          'granted',
          'Bạn đã đăng ký nhận role bằng reaction.',
          concurrentlyAddedClaim.expireAt,
          latestConfig.durationDays,
          latestConfig.every
        );
      }
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
    // Trừ coins nếu role có giá
    if (currentConfig.price && currentConfig.price > 0) {
      console.log(`[Reaction Role] Charging ${currentConfig.price} coins from ${member.user.tag}`);

      try {
        const chargeResult = await chargeCoins(
          member.id,
          currentConfig.price,
          `Nhận role ${config.role.name}`
        );

        if (chargeResult.insufficientBalance) {
          // Không đủ coins - gỡ claim và reaction
          await removeReactionRoleClaim(currentConfig, member.id);
          await reaction.users.remove(member.id);

          try {
            await member.send({
              content: `❌ **Không đủ coins**\n\n` +
                `Bạn cần **${currentConfig.price}** coins để nhận role **${config.role.name}**, ` +
                `nhưng số dư không đủ.\n\n` +
                `Dùng \`/coins-balance\` để kiểm tra số dư.`
            });
          } catch (dmError) {
            console.log(`[Reaction Role] Cannot DM ${member.user.tag} about insufficient balance`);
          }

          console.log(`[Reaction Role] ${member.user.tag} has insufficient balance (${currentConfig.price} coins required)`);
          return true; // Rejected
        }

        console.log(`[Reaction Role] Successfully charged ${currentConfig.price} coins from ${member.user.tag}`);
      } catch (chargeError) {
        // Lỗi API - gỡ claim và reaction
        console.error(`[ERROR] Failed to charge coins from ${member.user.tag}:`, chargeError);
        await removeReactionRoleClaim(currentConfig, member.id);
        await reaction.users.remove(member.id);

        try {
          await member.send({
            content: `❌ **Lỗi thanh toán**\n\n` +
              `Không thể trừ coins để nhận role **${config.role.name}**.\n` +
              `Vui lòng thử lại sau hoặc liên hệ admin.`
          });
        } catch (dmError) {
          console.log(`[Reaction Role] Cannot DM ${member.user.tag} about charge error`);
        }

        return true; // Rejected
      }
    }

    await setReactionRoleClaimsPreExisting(
      config.guildId,
      config.roleId,
      member.id,
      roleWasPreexisting
    );
    const newlyGranted = await ensureMemberRole(member, config.role);
    if (newlyGranted) {
      const priceNote = currentConfig.price > 0
        ? `\n\n💰 **Đã trả:** ${currentConfig.price} coins`
        : '';

      await sendRoleNotification(
        member,
        config.role,
        member.guild,
        'granted',
        `Bạn đã đăng ký nhận role bằng reaction.${priceNote}`,
        expireAt,
        currentConfig.durationDays,
        currentConfig.every
      );
    }
  } catch (error) {
    await removeReactionRoleClaim(currentConfig, member.id);
    throw error;
  }
  return false;
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
    const matchingConfigs = configs.filter(config => matchesReactionEmoji(config, emojiKey));

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
    console.log(`[DEBUG] handleReactionRoleRemove called for user ${user.tag} on message ${reaction.message.id}`);

    const context = await fetchReactionContext(reaction, user);
    if (!context) {
      console.log(`[DEBUG] No context found - bot user or no guild`);
      return;
    }

    const emojiKey = getReactionEmojiKey(reaction);
    console.log(`[DEBUG] Emoji key: ${emojiKey}`);

    const configs = await getReactionRoleConfigsForMessage(
      context.guild.id,
      context.message.id
    );
    console.log(`[DEBUG] Found ${configs.length} configs for this message`);

    const matchingConfigs = configs.filter(config => (
      matchesReactionEmoji(config, emojiKey)
      || config.claimants?.some(claim => (
        claim.userId === user.id && claim.emojiKeys?.includes(emojiKey)
      ))
    ));
    console.log(`[DEBUG] ${matchingConfigs.length} matching configs`);

    if (!matchingConfigs.length) {
      console.log(`[DEBUG] No matching configs - exiting`);
      return;
    }

    // BỎ QUA UNREACT - không làm gì cả
    // Role chỉ bị gỡ khi:
    // 1. Hết thời hạn (durationDays hoặc every schedule)
    // 2. Bot/admin xóa config
    console.log(`[Reaction Role] User ${user.tag} unreacted - ignoring (role kept until expiry or manual removal)`);

  } catch (error) {
    console.error('[ERROR] Failed to process reaction role remove:', error);
  }
}

export async function setConfig({
  guild,
  messageId,
  role,
  limit,
  emoji,
  durationDays,
  every,
  price = 0
}) {
  if (!snowflakePattern.test(messageId)) {
    throw new Error('Message ID không hợp lệ.');
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Limit phải là số nguyên dương.');
  }
  if (
    durationDays !== undefined
    && durationDays !== null
    && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 36500)
  ) {
    throw new Error('Thời hạn phải là số nguyên từ 1 đến 36.500 ngày.');
  }
  if (durationDays && every) {
    throw new Error('Không thể đặt cả duration_days và every cùng lúc.');
  }
  const everyTime = parseEveryTime(every);
  console.log('[DEBUG] setConfig called with:', { durationDays, every, everyTime });
  
  // Tìm message trong tất cả channels của guild
  let message = null;
  let channel = null;
  
  for (const ch of guild.channels.cache.values()) {
    if (ch.isTextBased()) {
      try {
        message = await ch.messages.fetch(messageId);
        channel = ch;
        break;
      } catch (error) {
        // Message không ở channel này, thử channel khác
        continue;
      }
    }
  }
  
  if (!message) {
    throw new Error('Không tìm thấy tin nhắn. Hãy chắc chắn bot có quyền xem kênh đó.');
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

  const { emojiKey, emojiLabel } = normalizeEmoji(emoji);

  // LUÔN xóa tất cả reactions khi setup/update config
  // Người dùng phải react lại sau khi config mới
  try {
    await message.reactions.removeAll();
    console.log(`[Reaction Role] Removed all reactions on message ${messageId}`);
  } catch (error) {
    console.warn('[WARN] Failed to remove existing reactions:', error);
  }

  // Bot react emoji để tạo button
  await message.react(emojiLabel);
  console.log(`[Reaction Role] Bot reacted ${emojiLabel} on message ${messageId}`);

  await saveReactionRoleConfig({
    guildId: guild.id,
    channelId: channel.id,
    messageId,
    roleId: role.id,
    emojiKey,
    emojiLabel,
    limit,
    durationDays,
    every: everyTime ? `${String(everyTime.hours).padStart(2, '0')}:${String(everyTime.minutes).padStart(2, '0')}` : null,
    price: price || 0
  });

  let durationText = 'không hết hạn';
  if (durationDays) durationText = `${durationDays} ngày`;
  else if (everyTime) {
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(everyTime.hours, everyTime.minutes, 0, 0);

    // Nếu giờ target đã qua hôm nay, tính sang ngày mai
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const diffMs = targetTime - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let countdown = '';
    if (diffHours > 0) countdown = `còn ${diffHours} giờ ${diffMinutes} phút`;
    else countdown = `còn ${diffMinutes} phút`;

    durationText = `gỡ mỗi ngày lúc ${String(everyTime.hours).padStart(2, '0')}:${String(everyTime.minutes).padStart(2, '0')} (${countdown})`;
  }
  console.log('[DEBUG] durationText result:', durationText, { durationDays, everyTime });

  const priceText = price > 0 ? `, giá **${price}** coins` : '';
  return `Đã lưu cấu hình: ${role} trên tin nhắn \`${message.id}\`, ` +
    `emoji \`${emojiLabel}\`, giới hạn **${limit}** thành viên, ` +
    `thời hạn **${durationText}**${priceText}.`;
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
        claim.userId === claimant.userId
        && claim.messageId !== messageId
        && isClaimActive(claim)
      ));
      if (remainingClaims.length || claimant.roleWasPreexisting || !role) continue;

      try {
        const member = await guild.members.fetch(claimant.userId);
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'Reaction role configuration removed');
          await sendRoleNotification(
            member,
            role,
            guild,
            'revoked',
            'Cấu hình reaction role đã bị quản trị viên xóa.'
          );
        }
      } catch (error) {
        if (error.code !== 10007) throw error;
      }
    }

    // Xóa toàn bộ reaction tương ứng với config này trên message
    try {
      const channel = guild.channels.cache.get(config.channelId)
        || await guild.channels.fetch(config.channelId).catch(() => null);
      if (channel) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) {
          const reactionToRemove = message.reactions.cache.find(r => {
            const key = r.emoji.id || r.emoji.name;
            return key === config.emojiKey;
          });
          if (reactionToRemove) {
            await reactionToRemove.remove();
            console.info(`[Reaction Role] Removed all reactions for emoji ${config.emojiKey} on message ${messageId}`);
          }
        }
      }
    } catch (error) {
      console.warn(`[WARN] Failed to remove reactions on message ${messageId}:`, error);
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

export async function processExpiredReactionRoleClaims(client) {
  const now = new Date();
  const expiredClaims = await getExpiredReactionRoleClaims(now);

  for (const { guildId, messageId, roleId, claimant } of expiredClaims) {
    await withRoleLock(roleLockKey(guildId, roleId), async () => {
      const config = await getReactionRoleConfig(guildId, messageId, roleId);
      const currentClaim = config?.claimants?.find(
        item => item.userId === claimant.userId
      );
      if (!currentClaim?.expireAt || currentClaim.expireAt > now) return;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        console.warn(
          `[WARN] Guild ${guildId} unavailable while expiring reaction role claim for ${claimant.userId}`
        );
        return;
      }

      let member;
      try {
        member = await guild.members.fetch(claimant.userId);
      } catch (error) {
        if (error.code === 10007 || error.code === 10013) {
          await removeExpiredReactionRoleClaim(config, claimant.userId, now);
          return;
        }
        throw error;
      }

      const otherClaims = await getReactionRoleClaimsForRole(
        guildId,
        roleId,
        claimant.userId
      );
      const hasOtherActiveClaim = otherClaims.some(claim => (
        claim.messageId !== messageId
        && isClaimActive(claim, now)
      ));

      if (
        !hasOtherActiveClaim
        && !currentClaim.roleWasPreexisting
        && member.roles.cache.has(roleId)
      ) {
        const role = guild.roles.cache.get(roleId)
          || await guild.roles.fetch(roleId).catch(error => {
            if (error.code === 10011) return null;
            throw error;
          });
        if (role) {
          await member.roles.remove(role, 'Reaction role duration expired');
          await sendRoleNotification(
            member,
            role,
            guild,
            'revoked',
            'Thời hạn nhận role đã kết thúc.'
          );
        }
      }

      // Gỡ reaction của user khi role hết hạn
      try {
        const channel = guild.channels.cache.get(config.channelId);
        if (channel) {
          const message = await channel.messages.fetch(config.messageId).catch(() => null);
          if (message) {
            const reactionToRemove = message.reactions.cache.find(r => {
              const emojiKey = r.emoji.id || r.emoji.name;
              return config.emojiKey === emojiKey || config.emojiKey === 'all';
            });
            if (reactionToRemove) {
              await reactionToRemove.users.remove(claimant.userId);
              console.log(`[Reaction Role] Removed reaction for expired role from user ${claimant.userId}`);
            }
          }
        }
      } catch (error) {
        console.error(`[ERROR] Failed to remove reaction for expired role:`, error);
      }

      await removeExpiredReactionRoleClaim(config, claimant.userId, now);
      console.info(
        `[INFO] Expired reaction role claim for member ${claimant.userId}, role ${roleId}`
      );
    }).catch(error => {
      console.error(
        `[ERROR] Failed to expire reaction role claim for member ${claimant.userId}, role ${roleId}:`,
        error
      );
    });
  }
}

export async function processScheduledReactionRoleRevoke(client) {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

  const scheduledConfigs = await getScheduledReactionRoleConfigs(currentTime);

  for (const config of scheduledConfigs) {
    for (const claimant of config.claimants || []) {
      await withRoleLock(roleLockKey(config.guildId, config.roleId), async () => {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) {
          console.warn(
            `[WARN] Guild ${config.guildId} unavailable for scheduled revoke of role ${config.roleId}`
          );
          return;
        }

        let member;
        try {
          member = await guild.members.fetch(claimant.userId);
        } catch (error) {
          if (error.code === 10007 || error.code === 10013) {
            await removeReactionRoleClaim(config, claimant.userId);
            return;
          }
          throw error;
        }

        const otherClaims = await getReactionRoleClaimsForRole(
          config.guildId,
          config.roleId,
          claimant.userId
        );
        const hasOtherActiveClaim = otherClaims.some(claim => (
          claim.messageId !== config.messageId
          && isClaimActive(claim, now)
        ));

        if (
          !hasOtherActiveClaim
          && !claimant.roleWasPreexisting
          && member.roles.cache.has(config.roleId)
        ) {
          const role = guild.roles.cache.get(config.roleId)
            || await guild.roles.fetch(config.roleId).catch(error => {
              if (error.code === 10011) return null;
              throw error;
            });
          if (role) {
            await member.roles.remove(role, 'Reaction role scheduled revoke');
            await sendRoleNotification(
              member,
              role,
              guild,
              'revoked',
              `Role được gỡ theo lịch hàng ngày lúc ${config.every}.`
            );
          }
        }

        // Gỡ reaction của user khi đến giờ scheduled revoke
        try {
          const channel = guild.channels.cache.get(config.channelId);
          if (channel) {
            const message = await channel.messages.fetch(config.messageId).catch(() => null);
            if (message) {
              // Tìm reaction tương ứng với config
              const reactionToRemove = message.reactions.cache.find(r => {
                const emojiKey = r.emoji.id || r.emoji.name;
                return config.emojiKey === emojiKey || config.emojiKey === 'all';
              });
              if (reactionToRemove) {
                await reactionToRemove.users.remove(claimant.userId);
                console.log(`[Reaction Role] Removed reaction for scheduled revoke from user ${claimant.userId}`);
              }
            }
          }
        } catch (error) {
          console.error(`[ERROR] Failed to remove reaction for scheduled revoke:`, error);
        }

        await removeReactionRoleClaim(config, claimant.userId);
        console.info(
          `[INFO] Scheduled revoke reaction role for member ${claimant.userId}, role ${config.roleId} at ${config.every}`
        );
      }).catch(error => {
        console.error(
          `[ERROR] Failed scheduled revoke for member ${claimant.userId}, role ${config.roleId}:`,
          error
        );
      });
    }
  }
}
