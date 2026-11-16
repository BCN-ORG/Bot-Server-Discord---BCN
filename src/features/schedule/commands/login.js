import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getScheduleAuthorizedRoles } from '../../../database/schedule.js';
import { loginToSchedule } from '../services/scheduleApi.js';

export const data = new SlashCommandBuilder()
  .setName('lich-hoc-login')
  .setDescription('Đăng nhập tài khoản sinh viên để xem lịch học');

export async function execute(interaction) {
  if (!interaction.inGuild() || !interaction.member) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng được trong máy chủ.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!(await hasScheduleAccess(interaction))) {
    await interaction.reply({
      content: 'Bạn cần có ít nhất một role được cấp quyền xem lịch học.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('schedule_login_modal')
    .setTitle('Đăng nhập để xem lịch học')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('student_id')
          .setLabel('Mã số sinh viên')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('student_password')
          .setLabel('Mật khẩu')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      )
    );
  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inGuild() || !interaction.member || !(await hasScheduleAccess(interaction))) {
    await interaction.editReply('Bạn cần có ít nhất một role được cấp quyền xem lịch học.');
    return;
  }

  const studentId = interaction.fields.getTextInputValue('student_id').trim();
  const password = interaction.fields.getTextInputValue('student_password');
  if (!studentId || !password) {
    await interaction.editReply('Vui lòng nhập mã số sinh viên và mật khẩu.');
    return;
  }

  try {
    await loginToSchedule(interaction.user.id, studentId, password);
    const embed = new EmbedBuilder()
      .setColor('#00a86b')
      .setTitle('Đăng nhập thành công')
      .setDescription('Thông tin đăng nhập đã được lưu an toàn. Bạn có thể dùng `/lich-hoc` để xem lịch.');
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply(`Không thể đăng nhập: ${error.message}`);
  }
}

async function hasScheduleAccess(interaction) {
  const allowedRoles = await getScheduleAuthorizedRoles(interaction.guildId);
  return allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
}
