import { PermissionFlagsBits } from 'discord.js';
import {
  addFineReportRole,
  createFineReport,
  getFineReportsWithAppeals,
  getFineReportById,
  getFineReportRoles,
  getFineReports,
  removeFineReportRole,
  submitFineReportAppeal,
  updateFineReportStatus
} from '../../database/fineReports.js';

const REPORT_STATUSES = new Set(['PENDING', 'REJECTED', 'PROCESSED']);
const reportLocks = new Map();

function isAdministrator(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false;
}

async function withReportLock(reportId, action) {
  const previous = reportLocks.get(reportId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => {
    release = resolve;
  });
  reportLocks.set(reportId, current);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (reportLocks.get(reportId) === current) reportLocks.delete(reportId);
  }
}

export async function addAllowedRole(guildId, role, addedBy) {
  if (!role || role.managed || role.id === guildId) {
    throw new Error('Role không hợp lệ để cấp quyền lập biên bản.');
  }
  await addFineReportRole(guildId, role.id, role.name, addedBy);
}

export async function removeAllowedRole(guildId, roleId) {
  return removeFineReportRole(guildId, roleId);
}

export async function listAllowedRoles(guildId) {
  return getFineReportRoles(guildId);
}

export async function ensureCanCreateReport(guild, reporter) {
  if (reporter.user.bot) {
    throw new Error('Tài khoản bot không thể lập biên bản.');
  }
  const allowedRoles = await getFineReportRoles(guild.id);
  if (!allowedRoles.length) {
    throw new Error('Chưa cấu hình role được phép lập biên bản.');
  }
  if (!allowedRoles.some(({ roleId }) => reporter.roles.cache.has(roleId))) {
    throw new Error('Bạn chưa có role được phép lập biên bản.');
  }
}

export async function createReportFromForm({
  guild,
  reporterMember,
  targetMember,
  amount,
  reason,
  details,
  evidence
}) {
  await ensureCanCreateReport(guild, reporterMember);
  if (targetMember.user.bot) throw new Error('Không thể lập biên bản cho tài khoản bot.');
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error('Số coins dự định phạt phải là số nguyên dương hợp lệ.');
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error('Lý do lập biên bản không được để trống.');

  return createFineReport({
    guildId: guild.id,
    targetUserId: targetMember.id,
    targetUsername: targetMember.user.username,
    reporterUserId: reporterMember.id,
    reporterUsername: reporterMember.user.username,
    amount,
    reason: trimmedReason,
    details: details.trim() || null,
    evidence: evidence.trim() || null
  });
}

export async function listReportsForInteraction(interaction, requestedUser, page = 1) {
  const isAdmin = isAdministrator(interaction);
  if (requestedUser && requestedUser.id !== interaction.user.id && !isAdmin) {
    throw new Error('Bạn chỉ có thể xem danh sách biên bản của chính mình.');
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new Error('Số trang phải là số nguyên dương.');
  }
  const targetUserId = requestedUser?.id || interaction.user.id;
  const result = await getFineReports({
    guildId: interaction.guild.id,
    targetUserId
  }, { limit: 10, skip: (page - 1) * 10 });
  const pageCount = Math.max(1, Math.ceil(result.totalCount / 10));
  if (page > pageCount) {
    throw new Error(`Không có trang ${page}; danh sách có ${pageCount} trang.`);
  }
  return {
    ...result,
    page,
    pageCount
  };
}

export async function getReportForInteraction(interaction, reportId) {
  const report = await getFineReportById(interaction.guild.id, reportId);
  if (!report) return null;
  if (
    !isAdministrator(interaction)
    && report.targetUserId !== interaction.user.id
  ) {
    throw new Error('Bạn chỉ có thể xem chi tiết biên bản của chính mình.');
  }
  return report;
}

export async function getReportForAppeal(interaction, reportId) {
  const report = await getFineReportById(interaction.guild.id, reportId);
  if (!report) {
    throw new Error('Không tìm thấy phiếu phạt này trong máy chủ.');
  }
  if (report.targetUserId !== interaction.user.id) {
    throw new Error('Bạn chỉ có thể kháng cáo phiếu phạt lập cho chính mình.');
  }
  if (report.appeal) {
    throw new Error('Phiếu phạt này đã được gửi kháng cáo; mỗi phiếu chỉ được kháng cáo một lần.');
  }
  return report;
}

export async function createFineReportAppeal({
  interaction,
  reportId,
  statement
}) {
  const report = await getReportForAppeal(interaction, reportId);
  const trimmedStatement = statement.trim();
  if (!trimmedStatement) {
    throw new Error('Nội dung kháng cáo không được để trống.');
  }

  const updatedReport = await submitFineReportAppeal({
    guildId: interaction.guild.id,
    reportId,
    userId: interaction.user.id,
    statement: trimmedStatement
  });
  if (!updatedReport) {
    throw new Error('Kháng cáo không được ghi nhận. Có thể phiếu đã được kháng cáo ở một yêu cầu khác.');
  }
  return { report, updatedReport };
}

export async function listAppealsForInteraction(interaction, page = 1) {
  if (!isAdministrator(interaction)) {
    throw new Error('Chỉ quản trị viên mới có thể xem danh sách kháng cáo.');
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new Error('Số trang phải là số nguyên dương.');
  }
  const result = await getFineReportsWithAppeals(interaction.guild.id, {
    limit: 10,
    skip: (page - 1) * 10
  });
  const pageCount = Math.max(1, Math.ceil(result.totalCount / 10));
  if (page > pageCount) {
    throw new Error(`Không có trang ${page}; danh sách có ${pageCount} trang.`);
  }
  return { ...result, page, pageCount };
}

export async function getAppealForAdministrator(interaction, reportId) {
  if (!isAdministrator(interaction)) {
    throw new Error('Chỉ quản trị viên mới có thể xem chi tiết kháng cáo.');
  }
  const report = await getFineReportById(interaction.guild.id, reportId);
  if (!report?.appeal) {
    return null;
  }
  return report;
}

export async function changeReportStatus({
  interaction,
  reportId,
  status,
  note
}) {
  if (!isAdministrator(interaction)) {
    throw new Error('Chỉ quản trị viên mới có thể cập nhật trạng thái biên bản.');
  }
  if (!REPORT_STATUSES.has(status)) {
    throw new Error('Trạng thái biên bản không hợp lệ.');
  }

  return withReportLock(reportId, async () => {
    const report = await getFineReportById(interaction.guild.id, reportId);
    if (!report) return null;
    if (report.status === status) {
      throw new Error(`Biên bản hiện đã ở trạng thái ${status}.`);
    }
    return updateFineReportStatus({
      guildId: interaction.guild.id,
      reportId,
      status,
      changedBy: interaction.user.id,
      note: note?.trim() || null
    });
  });
}
