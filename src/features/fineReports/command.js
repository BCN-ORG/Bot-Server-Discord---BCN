import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import {
  addAllowedRole,
  changeReportStatus,
  createFineReportAppeal,
  createReportFromForm,
  getAppealForAdministrator,
  getReportForAppeal,
  getReportForInteraction,
  listAppealsForInteraction,
  listAllowedRoles,
  listReportsForInteraction,
  removeAllowedRole
} from './controller.js';

const statusLabels = {
  PENDING: 'Chờ xử lý',
  REJECTED: 'Từ chối',
  PROCESSED: 'Đã xử lý'
};

function formatDate(date) {
  return new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function truncate(value, maxLength = 1000) {
  if (!value) return 'Không có';
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function createReportEmbed(report) {
  const embed = new EmbedBuilder()
    .setColor(report.status === 'REJECTED' ? '#777777' : '#e67e22')
    .setTitle('Biên bản phạt coins')
    .setDescription(`Mã biên bản: \`${report._id}\``)
    .addFields(
      { name: 'Người bị lập', value: `<@${report.targetUserId}>`, inline: true },
      { name: 'Số coins dự định phạt (chưa trừ)', value: `${report.amount}`, inline: true },
      { name: 'Trạng thái', value: statusLabels[report.status], inline: true },
      { name: 'Người lập', value: `<@${report.reporterUserId}> (\`${report.reporterUserId}\`)`, inline: false },
      { name: 'Thời gian lập', value: formatDate(report.createdAt), inline: false },
      { name: 'Lý do / nội dung biên bản', value: truncate(report.reason), inline: false }
    );

  if (report.details) {
    embed.addFields({ name: 'Mô tả / ghi chú', value: truncate(report.details), inline: false });
  }
  if (report.evidence) {
    embed.addFields({ name: 'Bằng chứng / liên kết', value: truncate(report.evidence), inline: false });
  }
  if (report.appeal) {
    embed.addFields(
      { name: 'Trạng thái kháng cáo', value: 'Đã gửi — đang chờ quản trị viên xem xét', inline: false },
      { name: 'Nội dung kháng cáo', value: truncate(report.appeal.statement), inline: false }
    );
  }

  const history = (report.statusHistory || []).slice(-5).map(item => (
    `• ${statusLabels[item.status] || item.status} — <@${item.changedBy}> — ${formatDate(item.changedAt)}` +
    (item.note ? `\n  Ghi chú: ${truncate(item.note, 250)}` : '')
  ));
  if (history.length) {
    embed.addFields({
      name: 'Lịch sử trạng thái gần đây',
      value: truncate(history.join('\n'), 1000),
      inline: false
    });
  }
  return embed;
}

function createListEmbed(user, result) {
  const embed = new EmbedBuilder()
    .setColor('#e67e22')
    .setTitle(`Biên bản phạt của ${user.username}`);

  if (!result.reports.length) {
    embed.addFields({ name: 'Danh sách', value: 'Không có biên bản nào.' });
  } else {
    embed.addFields({
      name: 'Biên bản gần đây',
      value: result.reports.map(report => (
        `• \`${report._id}\` — **${report.amount} coins dự định phạt** — ${statusLabels[report.status]} — ` +
        `${formatDate(report.createdAt)}`
      )).join('\n').slice(0, 1024)
    });
  }

  embed.addFields({
    name: 'Tổng kết',
    value:
      `Tổng số biên bản: **${result.totalCount}**\n` +
      `Tổng coins dự định phạt (chưa bị từ chối): **${result.recordedCoins}**\n` +
      `Coins dự định phạt đang chờ xử lý: **${result.pendingCoins}**`
  });
  if (result.totalCount > result.reports.length) {
    embed.setFooter({
      text: `Trang ${result.page}/${result.pageCount} • Dùng /fine list và chọn trang tiếp theo để xem thêm.`
    });
  } else if (result.totalCount) {
    embed.setFooter({ text: `Trang ${result.page}/${result.pageCount}` });
  }
  return embed;
}

function createAppealsListEmbed(result) {
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('Danh sách kháng cáo phiếu phạt');

  if (!result.reports.length) {
    embed.setDescription('Chưa có kháng cáo nào.');
  } else {
    embed.setDescription(result.reports.map(report => (
      `• Phiếu \`${report._id}\` — <@${report.targetUserId}> — ` +
      `${formatDate(report.appeal.appealedAt)} — Chờ xem xét\n` +
      `  Kháng cáo: ${truncate(report.appeal.statement, 160)}`
    )).join('\n').slice(0, 4000));
  }
  embed.setFooter({
    text: `Trang ${result.page}/${result.pageCount} • Dùng /fine appeal-detail report_id để xem chi tiết.`
  });
  return embed;
}

function createAppealDetailEmbed(report) {
  const appeal = report.appeal;
  return new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('Chi tiết kháng cáo phiếu phạt')
    .setDescription(`Mã phiếu phạt: \`${report._id}\``)
    .addFields(
      { name: 'Người bị lập', value: `<@${report.targetUserId}> (\`${report.targetUserId}\`)`, inline: true },
      { name: 'Người lập phiếu', value: `<@${report.reporterUserId}> (\`${report.reporterUserId}\`)`, inline: true },
      { name: 'Số coins dự định phạt', value: `${report.amount}`, inline: true },
      { name: 'Trạng thái phiếu', value: statusLabels[report.status] || report.status, inline: true },
      { name: 'Người gửi kháng cáo', value: `<@${appeal.appealedBy}> (\`${appeal.appealedBy}\`)`, inline: true },
      { name: 'Thời gian kháng cáo', value: formatDate(appeal.appealedAt), inline: false },
      { name: 'Lý do phiếu phạt', value: truncate(report.reason), inline: false },
      { name: 'Nội dung kháng cáo', value: truncate(appeal.statement), inline: false }
    );
}

async function notifyFineTarget(targetUser, guild, report) {
  const embed = new EmbedBuilder()
    .setColor('#e67e22')
    .setTitle('Bạn đã được lập phiếu phạt')
    .setDescription(`Bạn đã được lập phiếu phạt trong máy chủ **${guild.name}**.`)
    .addFields(
      { name: 'Mã phiếu phạt', value: `\`${report._id}\`` },
      { name: 'Số coins dự định phạt (chưa trừ)', value: `${report.amount}` },
      { name: 'Lý do phiếu phạt', value: truncate(report.reason) },
      {
        name: 'Kháng cáo',
        value: `Bạn có thể kháng cáo một lần bằng lệnh \`/fine appeal\` với mã phiếu \`${report._id}\`.`
      }
    )
    .setTimestamp(report.createdAt);

  try {
    await targetUser.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.warn(`[WARN] Could not DM fine report ${report._id} to ${targetUser.id}:`, error);
    return false;
  }
}

function getModalMemberName(member) {
  const nickname = (member.nickname || member.nick || '').trim();
  return nickname || member.user.username;
}

function createFineModal(reporterId, targetMember) {
  const targetName = getModalMemberName(targetMember);
  const targetUserId = targetMember.id || targetMember.user.id;
  return new ModalBuilder()
    .setCustomId(`fine_report_modal:${reporterId}:${targetUserId}`)
    .setTitle('Lập biên bản phạt coins')
    .addComponents(
      new TextDisplayBuilder()
        .setContent(`**Người bị lập:** ${targetName} (\`${targetUserId}\`)`),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Số coins dự định phạt (chưa trừ)')
          .setPlaceholder('Nhập số nguyên dương')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(15)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Lý do / nội dung biên bản')
          .setPlaceholder('Trình bày đầy đủ sự việc và lý do lập biên bản')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
}

function createAppealModal(userId, report) {
  return new ModalBuilder()
    .setCustomId(`fine_appeal_modal:${userId}:${report._id}`)
    .setTitle('Kháng cáo phiếu phạt')
    .addComponents(
      new TextDisplayBuilder()
        .setContent(`**Lý do phiếu phạt:**\n${truncate(report.reason, 900)}`),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('statement')
          .setLabel('Nội dung trình bày kháng cáo')
          .setPlaceholder('Nêu rõ lý do bạn đề nghị xem xét lại phiếu phạt')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
}

export const data = new SlashCommandBuilder()
  .setName('fine')
  .setDescription('Lập và tra cứu biên bản phạt coins')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Chọn người bị lập, sau đó nhập thông tin biên bản')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Thành viên bị lập biên bản')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sách biên bản của bạn')
      .addUserOption(option =>
        option.setName('member').setDescription('Chỉ quản trị viên mới xem được người khác').setRequired(false)
      )
      .addIntegerOption(option =>
        option.setName('page').setDescription('Số trang (mỗi trang tối đa 10 biên bản)').setMinValue(1).setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('detail')
      .setDescription('Xem chi tiết biên bản')
      .addStringOption(option =>
        option.setName('report_id').setDescription('Mã biên bản').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('appeal')
      .setDescription('Gửi kháng cáo cho phiếu phạt của bạn')
      .addStringOption(option =>
        option.setName('report_id').setDescription('Mã phiếu phạt được gửi qua DM').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('appeals')
      .setDescription('Xem danh sách kháng cáo (quản trị viên)')
      .addIntegerOption(option =>
        option.setName('page').setDescription('Số trang').setMinValue(1).setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('appeal-detail')
      .setDescription('Xem chi tiết kháng cáo theo mã phiếu (quản trị viên)')
      .addStringOption(option =>
        option.setName('report_id').setDescription('Mã phiếu phạt').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('role-add')
      .setDescription('Thêm role được phép lập biên bản (quản trị viên)')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role được cấp quyền lập biên bản').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('role-remove')
      .setDescription('Xóa role được phép lập biên bản (quản trị viên)')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role cần xóa khỏi danh sách').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('roles')
      .setDescription('Xem danh sách role được phép lập biên bản')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Đổi trạng thái biên bản (quản trị viên)')
      .addStringOption(option =>
        option.setName('report_id').setDescription('Mã biên bản').setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('status')
          .setDescription('Trạng thái mới')
          .setRequired(true)
          .addChoices(
            { name: 'Chờ xử lý', value: 'PENDING' },
            { name: 'Từ chối', value: 'REJECTED' },
            { name: 'Đã xử lý', value: 'PROCESSED' }
          )
      )
      .addStringOption(option =>
        option.setName('note').setDescription('Ghi chú xử lý (không bắt buộc)').setRequired(false)
      )
  );

async function requireAdministrator(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Lệnh này chỉ dành cho quản trị viên.');
  }
}

export async function execute(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      const targetUser = interaction.options.getUser('user', true);
      if (targetUser.bot) throw new Error('Không thể lập biên bản cho tài khoản bot.');
      const targetMember = interaction.options.getMember('user') || {
        id: targetUser.id,
        nickname: null,
        user: targetUser
      };
      await interaction.showModal(createFineModal(interaction.user.id, targetMember));
      return;
    }

    if (subcommand === 'appeal') {
      const reportId = interaction.options.getString('report_id', true).trim();
      const report = await getReportForAppeal(interaction, reportId);
      await interaction.showModal(createAppealModal(interaction.user.id, report));
      return;
    }

    if (subcommand === 'appeals') {
      const result = await listAppealsForInteraction(
        interaction,
        interaction.options.getInteger('page') || 1
      );
      await interaction.reply({
        embeds: [createAppealsListEmbed(result)],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'appeal-detail') {
      await requireAdministrator(interaction);
      const report = await getAppealForAdministrator(
        interaction,
        interaction.options.getString('report_id', true).trim()
      );
      await interaction.reply({
        embeds: [report ? createAppealDetailEmbed(report) : new EmbedBuilder()
          .setColor('#777777')
          .setTitle('Không tìm thấy kháng cáo')
          .setDescription('Không có kháng cáo tương ứng với mã phiếu này trong máy chủ.')],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'list') {
      const requestedUser = interaction.options.getUser('member');
      const page = interaction.options.getInteger('page') || 1;
      const result = await listReportsForInteraction(interaction, requestedUser, page);
      await interaction.reply({
        embeds: [createListEmbed(requestedUser || interaction.user, result)],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'detail') {
      const reportId = interaction.options.getString('report_id', true).trim();
      const report = await getReportForInteraction(interaction, reportId);
      await interaction.reply({
        embeds: [report ? createReportEmbed(report) : new EmbedBuilder()
          .setColor('#777777')
          .setTitle('Không tìm thấy biên bản')
          .setDescription(`Không có biên bản \`${reportId}\` trong máy chủ này.`)],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'role-add') {
      await requireAdministrator(interaction);
      const role = interaction.options.getRole('role', true);
      await addAllowedRole(interaction.guild.id, role, interaction.user.id);
      await interaction.reply({ content: `Đã cấp quyền lập biên bản cho role ${role}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'role-remove') {
      await requireAdministrator(interaction);
      const role = interaction.options.getRole('role', true);
      const result = await removeAllowedRole(interaction.guild.id, role.id);
      await interaction.reply({
        content: result.deletedCount
          ? `Đã xóa role ${role} khỏi danh sách được phép lập biên bản.`
          : 'Role này không có trong danh sách được phép lập biên bản.',
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'roles') {
      const roles = await listAllowedRoles(interaction.guild.id);
      const description = roles.length
        ? roles.map(({ roleId, roleName }) => `• <@&${roleId}> — ${roleName}`).join('\n')
        : 'Chưa có role nào được cấu hình.';
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#3498db').setTitle('Role được phép lập biên bản').setDescription(description)],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'status') {
      await requireAdministrator(interaction);
      const report = await changeReportStatus({
        interaction,
        reportId: interaction.options.getString('report_id', true).trim(),
        status: interaction.options.getString('status', true),
        note: interaction.options.getString('note')
      });
      await interaction.reply({
        embeds: [report ? createReportEmbed(report) : new EmbedBuilder()
          .setColor('#777777')
          .setTitle('Không tìm thấy biên bản')],
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('[ERROR] Fine report command failed:', error);
    const reply = {
      embeds: [new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('Không thể xử lý biên bản')
        .setDescription(truncate(error.message, 1000))],
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

export async function handleModalSubmit(interaction) {
  const [, reporterUserId, targetUserId] = interaction.customId.split(':');
  try {
    await interaction.deferReply({ ephemeral: true });
    if (interaction.user.id !== reporterUserId) {
      throw new Error('Chỉ người đã mở form mới có thể gửi biên bản này.');
    }
    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(error => {
      if (error.code === 10007 || error.code === 10013) {
        throw new Error('Không tìm thấy thành viên này trong máy chủ hiện tại.');
      }
      throw error;
    });
    if (targetMember.user.bot) {
      throw new Error('Không thể lập biên bản cho tài khoản bot.');
    }
    const reporterMember = await interaction.guild.members.fetch(interaction.user.id);
    const report = await createReportFromForm({
      guild: interaction.guild,
      reporterMember,
      targetMember,
      amount: Number(interaction.fields.getTextInputValue('amount').trim()),
      reason: interaction.fields.getTextInputValue('reason'),
      details: '',
      evidence: ''
    });
    const dmSent = await notifyFineTarget(targetMember.user, interaction.guild, report);
    const confirmation = createReportEmbed(report).addFields({
      name: 'Thông báo riêng',
      value: dmSent
        ? 'Đã gửi DM cho người bị lập kèm mã phiếu và hướng dẫn kháng cáo.'
        : 'Không gửi được DM; người bị lập có thể đã tắt tin nhắn riêng.'
    });
    await interaction.editReply({
      embeds: [confirmation],
    });
  } catch (error) {
    console.error('[ERROR] Fine report modal submission failed:', error);
    const reply = {
      embeds: [new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('Không thể lập biên bản')
        .setDescription(truncate(error.message, 1000))]
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply({ ...reply, ephemeral: true });
    }
  }
}

export async function handleAppealModalSubmit(interaction) {
  const [, userId, reportId] = interaction.customId.split(':');
  try {
    await interaction.deferReply({ ephemeral: true });
    if (interaction.user.id !== userId) {
      throw new Error('Chỉ người mở form mới có thể gửi kháng cáo này.');
    }
    const result = await createFineReportAppeal({
      interaction,
      reportId,
      statement: interaction.fields.getTextInputValue('statement')
    });
    const embed = createAppealDetailEmbed(result.updatedReport)
      .setTitle('Đã gửi kháng cáo')
      .setFooter({ text: 'Mỗi phiếu phạt chỉ được kháng cáo một lần.' });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[ERROR] Fine report appeal submission failed:', error);
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('Không thể gửi kháng cáo')
        .setDescription(truncate(error.message, 1000))]
    });
  }
}
