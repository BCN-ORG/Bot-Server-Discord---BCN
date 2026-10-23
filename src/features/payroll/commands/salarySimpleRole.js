import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  deleteSimpleSalaryForRole,
  getAllSimpleRoleSalaries,
  getSimpleSalaryByRole,
  setSimpleSalaryForRole
} from '../../../database/payroll.js';

export const data = new SlashCommandBuilder()
  .setName('salary-simple-role')
  .setDescription('Cấu hình lương cố định theo role')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Đặt mức lương cố định cho role')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role nhận lương').setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription('Số coin cố định mỗi kỳ (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('get')
      .setDescription('Xem mức lương cố định của role')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role cần xem').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('list').setDescription('Xem danh sách role có lương cố định')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Xóa mức lương cố định của role')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role cần xóa').setRequired(true)
      )
  );

export async function execute(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      const role = interaction.options.getRole('role');
      const amount = interaction.options.getInteger('amount');
      await setSimpleSalaryForRole(role.id, role.name, amount, interaction.user.id);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00b300')
            .setTitle('Đã cập nhật lương cố định')
            .addFields(
              { name: 'Role', value: `${role}`, inline: true },
              { name: 'Lương mỗi kỳ', value: `${amount} coin`, inline: true }
            )
            .setTimestamp()
        ],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'get') {
      const role = interaction.options.getRole('role');
      const salary = await getSimpleSalaryByRole(role.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(salary ? '#0099ff' : '#ff9900')
            .setTitle(salary ? 'Lương cố định của role' : 'Role chưa có lương cố định')
            .setDescription(salary ? `${role} nhận **${salary.amount} coin** mỗi kỳ.` : `${role} chưa được cấu hình.`)
            .setTimestamp()
        ],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'list') {
      const salaries = await getAllSimpleRoleSalaries();
      const description = salaries.length
        ? salaries.map(item => `<@&${item.roleId}>: **${item.amount} coin/kỳ**`).join('\n')
        : 'Chưa có role nào được cấu hình lương cố định.';

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Danh sách lương cố định theo role')
            .setDescription(description)
            .setTimestamp()
        ],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'delete') {
      const role = interaction.options.getRole('role');
      const deleted = await deleteSimpleSalaryForRole(role.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(deleted ? '#00b300' : '#ff9900')
            .setTitle(deleted ? 'Đã xóa lương cố định' : 'Không tìm thấy cấu hình')
            .setDescription(deleted ? `Đã xóa mức lương cố định của ${role}.` : `${role} chưa có cấu hình lương cố định.`)
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('[ERROR] Salary simple role command error:', error);
    const response = {
      content: 'Đã xảy ra lỗi khi xử lý cấu hình lương cố định.',
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
}
