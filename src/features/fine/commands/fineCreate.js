import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getFineConfig } from '../../../database/fines.js';
import { hasAuthorizedRole } from '../services/fineService.js';
import { createFineModal } from '../modals/fineCreateModal.js';

export const data = new SlashCommandBuilder()
  .setName('fine-create')
  .setDescription('Lập biên bản phạt cho một thành viên')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Thành viên bị phạt')
      .setRequired(true)
  );

export async function execute(interaction) {
  try {
    const guildId = interaction.guild.id;
    const config = await getFineConfig(guildId);

    // Check if user has authorized role
    if (!hasAuthorizedRole(interaction.member, config.authorizedRoles)) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Không Có Quyền')
        .setDescription('Bạn không có quyền lập biên bản phạt!')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    
    // Check if user is bot
    if (user.bot) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Không thể lập biên bản phạt cho bot!')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Show modal
    const modal = createFineModal(user.id);
    await interaction.showModal(modal);

  } catch (error) {
    console.error('[Fine Create] Error:', error);
    
    // Only reply if we haven't interacted yet
    if (!interaction.replied && !interaction.deferred) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
        .setTimestamp();

      try {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      } catch (replyError) {
        console.error('[Fine Create] Could not send error reply:', replyError);
      }
    }
  }
}
