import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getViolationConfig, addAuthorizedRole, removeAuthorizedRole } from '../../../database/violations.js';

export const data = new SlashCommandBuilder()
  .setName('violation-authorized-roles')
  .setDescription('Quản lý role được phép lập biên bản phạt')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Thêm role được phép lập biên bản phạt')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role cần thêm')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xóa role khỏi danh sách được phép lập biên bản phạt')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role cần xóa')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sách role được phép lập biên bản phạt')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    if (subcommand === 'add') {
      const role = interaction.options.getRole('role');
      
      const result = await addAuthorizedRole(guildId, role.id);

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Đã thêm role')
          .setDescription(`Role ${role} đã được thêm vào danh sách được phép lập biên bản phạt.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Cảnh báo')
          .setDescription(result.message)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } else if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');
      
      await removeAuthorizedRole(guildId, role.id);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Đã xóa role')
        .setDescription(`Role ${role} đã được xóa khỏi danh sách được phép lập biên bản phạt.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (subcommand === 'list') {
      const config = await getViolationConfig(guildId);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Danh sách role được phép lập biên bản phạt')
        .setTimestamp();

      if (config.authorizedRoles.length === 0) {
        embed.setDescription('Chưa có role nào được phép lập biên bản phạt.');
      } else {
        const roleList = config.authorizedRoles
          .map(roleId => `• <@&${roleId}>`)
          .join('\n');
        embed.setDescription(roleList);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (error) {
    console.error('[Violation Command] Error in authorized-roles:', error);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Có lỗi xảy ra khi xử lý lệnh. Vui lòng thử lại sau.')
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
