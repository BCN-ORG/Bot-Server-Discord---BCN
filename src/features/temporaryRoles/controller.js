import { PermissionFlagsBits } from 'discord.js';
import {
  countManagedRoleScheduleMembers,
  createOrUpdateRoleSchedule,
  finishRoleSchedule,
  getActiveRoleScheduleById,
  getActiveRoleSchedules,
  getActiveRoleSchedulesForGuild,
  getRoleScheduleMembers,
  saveRoleScheduleMember,
  setRoleScheduleClosingStatus,
  setRoleScheduleMemberCount
} from '../../database/temporaryRoles.js';

const sessionLocks = new Map();
const sessionIdPattern = /^[a-f\d]{24}$/i;
const terminalMemberStatuses = new Set(['REVOKED', 'USER_LEFT']);

function scheduleLockKey(schedule) {
  return `${schedule.guildId}:${schedule.groupRoleId}:${schedule.targetRoleId}`;
}

async function withSessionLock(lockKey, action) {
  const previous = sessionLocks.get(lockKey) || Promise.resolve();
  let release;
  const current = new Promise(resolve => {
    release = resolve;
  });
  sessionLocks.set(lockKey, current);

  await previous;
  try {
    return await action();
  } finally {
    release();
    if (sessionLocks.get(lockKey) === current) sessionLocks.delete(lockKey);
  }
}

function isUnknownMember(error) {
  return error.code === 10007 || error.code === 10013;
}

function validateRole(guild, role, label, { allowManaged = false } = {}) {
  if (!role || role.guild.id !== guild.id || (!allowManaged && role.managed)) {
    throw new Error(`${label} không hợp lệ hoặc không thể quản lý.`);
  }
}

async function ensureManageableTargetRole(guild, targetRole) {
  const botMember = await guild.members.fetchMe();
  if (
    !botMember.permissions.has(PermissionFlagsBits.ManageRoles)
    || !targetRole.editable
  ) {
    throw new Error(
      'Bot cần quyền Manage Roles và role đích phải thấp hơn role cao nhất của bot.'
    );
  }
}

async function markMemberFailure(schedule, userId, operation, error) {
  await saveRoleScheduleMember(schedule._id, userId, {
    status: 'FAILED',
    operation,
    errorMessage: error.message,
    lastAttemptAt: new Date()
  });
}

async function assignRole(schedule, member, targetRole, detail) {
  const trackedStatuses = new Set([
    'ASSIGNED',
    'PENDING_ASSIGN',
    'PENDING_REVOKE',
    'FAILED'
  ]);

  if (member.roles.cache.has(targetRole.id)) {
    if (detail && trackedStatuses.has(detail.status)) {
      await saveRoleScheduleMember(schedule._id, member.id, {
        status: 'ASSIGNED',
        operation: null,
        assignedAt: detail.assignedAt || new Date(),
        revokedAt: null,
        errorMessage: null
      });
    }
    return { assigned: false, skipped: true, failed: false };
  }

  if (detail?.status === 'ASSIGNED') {
    await saveRoleScheduleMember(schedule._id, member.id, {
      status: 'PENDING_ASSIGN',
      operation: 'ASSIGN',
      lastAttemptAt: new Date()
    });
  } else {
    await saveRoleScheduleMember(schedule._id, member.id, {
      status: 'PENDING_ASSIGN',
      operation: 'ASSIGN',
      assignedAt: null,
      revokedAt: null,
      errorMessage: null,
      lastAttemptAt: new Date()
    });
  }

  try {
    await member.roles.add(targetRole, `Temporary role schedule ${schedule._id}`);
    await saveRoleScheduleMember(schedule._id, member.id, {
      status: 'ASSIGNED',
      operation: null,
      assignedAt: new Date(),
      errorMessage: null
    });
    return { assigned: true, skipped: false, failed: false };
  } catch (error) {
    await markMemberFailure(schedule, member.id, 'ASSIGN', error);
    console.error(
      `[ERROR] Failed to assign role in schedule ${schedule._id} to member ${member.id}:`,
      error
    );
    return { assigned: false, skipped: false, failed: true };
  }
}

async function processPendingAssignment(schedule, detail, guild, targetRole) {
  let member;
  try {
    member = await guild.members.fetch(detail.userId);
  } catch (error) {
    if (isUnknownMember(error)) {
      await saveRoleScheduleMember(schedule._id, detail.userId, {
        status: 'USER_LEFT',
        operation: null,
        errorMessage: error.message
      });
      return 'USER_LEFT';
    }
    await markMemberFailure(schedule, detail.userId, 'ASSIGN', error);
    console.error(
      `[ERROR] Failed to fetch member ${detail.userId} for role schedule ${schedule._id}:`,
      error
    );
    return 'FAILED';
  }

  if (member.roles.cache.has(targetRole.id)) {
    await saveRoleScheduleMember(schedule._id, member.id, {
      status: 'ASSIGNED',
      operation: null,
      assignedAt: detail.assignedAt || new Date(),
      errorMessage: null
    });
    return 'ASSIGNED';
  }

  await saveRoleScheduleMember(schedule._id, member.id, {
    status: 'PENDING_ASSIGN',
    operation: 'ASSIGN',
    lastAttemptAt: new Date()
  });
  try {
    await member.roles.add(targetRole, `Recover temporary role schedule ${schedule._id}`);
    await saveRoleScheduleMember(schedule._id, member.id, {
      status: 'ASSIGNED',
      operation: null,
      assignedAt: new Date(),
      errorMessage: null
    });
    return 'ASSIGNED';
  } catch (error) {
    await markMemberFailure(schedule, member.id, 'ASSIGN', error);
    console.error(
      `[ERROR] Failed to recover role assignment in schedule ${schedule._id} for member ${member.id}:`,
      error
    );
    return 'FAILED';
  }
}

async function revokeScheduleRoles(schedule, guild, requestedStatus) {
  await setRoleScheduleClosingStatus(schedule._id, requestedStatus);

  const details = await getRoleScheduleMembers(schedule._id);
  let targetRole;
  try {
    targetRole = await guild.roles.fetch(schedule.targetRoleId);
  } catch (error) {
    if (error.code !== 10011) {
      console.error(
        `[ERROR] Failed to fetch target role for temporary role schedule ${schedule._id}:`,
        error
      );
      return { completed: false, revoked: 0 };
    }
    targetRole = null;
  }

  for (const detail of details) {
    if (terminalMemberStatuses.has(detail.status)) continue;

    let member;
    try {
      member = await guild.members.fetch(detail.userId);
    } catch (error) {
      if (isUnknownMember(error)) {
        await saveRoleScheduleMember(schedule._id, detail.userId, {
          status: 'USER_LEFT',
          operation: null,
          revokedAt: new Date(),
          errorMessage: null
        });
        continue;
      }
      await markMemberFailure(schedule, detail.userId, 'REVOKE', error);
      console.error(
        `[ERROR] Failed to fetch member ${detail.userId} for role schedule ${schedule._id}:`,
        error
      );
      continue;
    }

    if (!targetRole || !member.roles.cache.has(schedule.targetRoleId)) {
      await saveRoleScheduleMember(schedule._id, detail.userId, {
        status: 'REVOKED',
        operation: null,
        revokedAt: new Date(),
        errorMessage: null
      });
      continue;
    }

    await saveRoleScheduleMember(schedule._id, detail.userId, {
      status: 'PENDING_REVOKE',
      operation: 'REVOKE',
      lastAttemptAt: new Date()
    });
    try {
      await member.roles.remove(
        targetRole,
        `Temporary role schedule ${schedule._id} ended`
      );
      await saveRoleScheduleMember(schedule._id, detail.userId, {
        status: 'REVOKED',
        operation: null,
        revokedAt: new Date(),
        errorMessage: null
      });
    } catch (error) {
      await markMemberFailure(schedule, detail.userId, 'REVOKE', error);
      console.error(
        `[ERROR] Failed to revoke role in schedule ${schedule._id} from member ${detail.userId}:`,
        error
      );
    }
  }

  const refreshedDetails = await getRoleScheduleMembers(schedule._id);
  const hasPendingRevocations = refreshedDetails.some(detail => (
    !terminalMemberStatuses.has(detail.status)
  ));
  const processedMembers = refreshedDetails.filter(detail => (
    terminalMemberStatuses.has(detail.status)
  )).length;
  const totalMembers = await countManagedRoleScheduleMembers(schedule._id);
  await setRoleScheduleMemberCount(schedule._id, totalMembers);
  if (!hasPendingRevocations) {
    await finishRoleSchedule(
      schedule._id,
      schedule.closingStatus || requestedStatus
    );
    return { completed: true, revoked: processedMembers };
  }

  return {
    completed: false,
    revoked: processedMembers
  };
}

export async function setTemporaryRoleSchedule({
  guild,
  groupRole,
  targetRole,
  durationDays
}) {
  validateRole(guild, groupRole, 'Role nhóm', { allowManaged: true });
  validateRole(guild, targetRole, 'Role đích');
  if (groupRole.id === targetRole.id) {
    throw new Error('Role nhóm và role đích phải khác nhau.');
  }
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 36500) {
    throw new Error('Thời hạn phải là số nguyên từ 1 đến 36.500 ngày.');
  }
  await ensureManageableTargetRole(guild, targetRole);

  return withSessionLock(
    `${guild.id}:${groupRole.id}:${targetRole.id}`,
    async () => {
      const members = await guild.members.fetch();
      const { schedule, created } = await createOrUpdateRoleSchedule({
        guildId: guild.id,
        groupRoleId: groupRole.id,
        targetRoleId: targetRole.id,
        durationDays
      });
      const currentSchedule = await getActiveRoleScheduleById(
        schedule._id.toString(),
        guild.id
      );
      if (!currentSchedule) {
        throw new Error('Phiên đã được kết thúc đồng thời; hãy chạy lại lệnh.');
      }

      const details = await getRoleScheduleMembers(schedule._id);
      const detailsByUser = new Map(details.map(detail => [detail.userId, detail]));
      let assigned = 0;
      let skipped = 0;
      let failed = 0;

      for (const member of members.values()) {
        if (member.user.bot || !member.roles.cache.has(groupRole.id)) continue;

        const previous = detailsByUser.get(member.id);
        if (
          previous?.status === 'PENDING_ASSIGN'
          || (previous?.status === 'FAILED' && previous.operation === 'ASSIGN')
        ) {
          const result = await processPendingAssignment(
            currentSchedule,
            previous,
            guild,
            targetRole
          );
          if (result === 'ASSIGNED') assigned += 1;
          if (result === 'FAILED') failed += 1;
          if (result === 'USER_LEFT') skipped += 1;
          continue;
        }

        const assignment = await assignRole(
          currentSchedule,
          member,
          targetRole,
          detailsByUser.get(member.id)
        );
        if (assignment.assigned) assigned += 1;
        if (assignment.skipped) skipped += 1;
        if (assignment.failed) failed += 1;
      }

      const totalMembers = await countManagedRoleScheduleMembers(schedule._id);
      await setRoleScheduleMemberCount(schedule._id, totalMembers);
      return {
        schedule: currentSchedule,
        created,
        assigned,
        skipped,
        failed,
        totalMembers
      };
    }
  );
}

export async function listTemporaryRoleSchedules(guildId) {
  const schedules = await getActiveRoleSchedulesForGuild(guildId);
  return Promise.all(schedules.map(async schedule => ({
    ...schedule,
    totalMembers: await countManagedRoleScheduleMembers(schedule._id)
  })));
}

export async function revokeTemporaryRoleSchedule(guild, sessionId) {
  if (!sessionIdPattern.test(sessionId)) {
    throw new Error('Mã phiên không hợp lệ; cần mã ObjectId gồm 24 ký tự hex.');
  }

  const schedule = await getActiveRoleScheduleById(sessionId, guild.id);
  if (!schedule) {
    throw new Error('Không tìm thấy phiên ACTIVE trong server hiện tại.');
  }

  return withSessionLock(scheduleLockKey(schedule), async () => {
    const currentSchedule = await getActiveRoleScheduleById(sessionId, guild.id);
    if (!currentSchedule) {
      throw new Error('Phiên đã được kết thúc trước khi bắt đầu thu hồi.');
    }
    return revokeScheduleRoles(currentSchedule, guild, 'REVOKED');
  });
}

export async function processTemporaryRoleSchedules(client) {
  const schedules = await getActiveRoleSchedules();

  for (const schedule of schedules) {
    await withSessionLock(scheduleLockKey(schedule), async () => {
      const currentSchedule = await getActiveRoleScheduleById(
        schedule._id.toString(),
        schedule.guildId
      );
      if (!currentSchedule) return;

      const due = currentSchedule.expireAt <= new Date();
      const hasClosingStatus = Boolean(currentSchedule.closingStatus);
      const guild = client.guilds.cache.get(schedule.guildId);
      if (!guild) {
        if (due || hasClosingStatus) {
          console.warn(
            `[WARN] Guild ${schedule.guildId} unavailable for temporary role schedule ${schedule._id}`
          );
        }
        return;
      }

      if (due || hasClosingStatus) {
        await revokeScheduleRoles(
          currentSchedule,
          guild,
          currentSchedule.closingStatus || 'EXPIRED'
        );
        return;
      }

      const details = await getRoleScheduleMembers(currentSchedule._id);
      const pendingAssignments = details.filter(detail => (
        detail.status === 'PENDING_ASSIGN'
        || (detail.status === 'FAILED' && detail.operation === 'ASSIGN')
      ));
      if (!pendingAssignments.length) return;

      let targetRole;
      try {
        targetRole = await guild.roles.fetch(currentSchedule.targetRoleId);
      } catch (error) {
        console.error(
          `[ERROR] Failed to fetch target role for temporary role schedule ${currentSchedule._id}:`,
          error
        );
        return;
      }
      if (!targetRole) {
        for (const detail of pendingAssignments) {
          await markMemberFailure(
            currentSchedule,
            detail.userId,
            'ASSIGN',
            new Error(`Role ${currentSchedule.targetRoleId} no longer exists.`)
          );
        }
        return;
      }

      for (const detail of pendingAssignments) {
        try {
          await processPendingAssignment(currentSchedule, detail, guild, targetRole);
        } catch (error) {
          await markMemberFailure(currentSchedule, detail.userId, 'ASSIGN', error);
          console.error(
            `[ERROR] Failed to recover temporary role schedule ${currentSchedule._id} for member ${detail.userId}:`,
            error
          );
        }
      }
      const totalMembers = await countManagedRoleScheduleMembers(currentSchedule._id);
      await setRoleScheduleMemberCount(currentSchedule._id, totalMembers);
    });
  }
}
