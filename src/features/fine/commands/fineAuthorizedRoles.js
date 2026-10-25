import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  getFineConfig,
  addAuthorizedRole,
  removeAuthorizedRole
} from '../../../database/fines.js';

export const data = new SlashCommandBuilder()
  .setName('fine-authorized-roles')
  .setDescription('Quản lý roles được phép lập biên bản phạt')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Thêm role được phép lập biên bản')
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
      .setDescription('Xóa role khỏi danh sách')
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
      .setDescription('Xem danh sách roles được phép lập biên bản')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    if (subcommand === 'add') {
      const role = interaction.options.getRole('role');
      
      await addAuthorizedRole(guildId, role.id);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Thêm Role Thành Công')
        .setDescription(`Đã thêm ${role} vào danh sách roles được phép lập biên bản phạt`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');
      
      const success = await removeAuthorizedRole(guildId, role.id);

      if (success) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Xóa Role Thành Công')
          .setDescription(`Đã xóa ${role} khỏi danh sách roles được phép lập biên bản phạt`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Thông Báo')
          .setDescription(`Role ${role} không có trong danh sách`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } else if (subcommand === 'list') {
      const config = await getFineConfig(guildId);

      if (config.authorizedRoles.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('📋 Danh Sách Roles')
          .setDescription('Chưa có role nào được cấu hình')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const roleList = config.authorizedRoles
        .map(roleId => `<@&${roleId}>`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Danh Sách Roles Được Phép Lập Biên Bản')
        .setDescription(roleList)
        .setFooter({ text: `Tổng: ${config.authorizedRoles.length} role(s)` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (error) {
    console.error('[Fine Authorized Roles] Error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}
