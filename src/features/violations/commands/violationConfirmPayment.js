import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { confirmPayment } from '../services/violationService.js';

export const data = new SlashCommandBuilder()
  .setName('violation-confirm-payment')
  .setDescription('Xác nhận thanh toán biên bản phạt')
  .addStringOption(option =>
    option
      .setName('violation_id')
      .setDescription('Mã biên bản phạt (ví dụ: VIO-20261024-001)')
      .setRequired(true)
  );

export async function execute(interaction) {
  try {
    const violationId = interaction.options.getString('violation_id');
    const payerId = interaction.user.id;

    // Defer reply as this involves API call
    await interaction.deferReply({ ephemeral: true });

    // Process payment
    const result = await confirmPayment({
      violationId,
      payerId,
      interaction
    });

    const embed = new EmbedBuilder()
      .setColor(result.success ? '#00ff00' : '#ff0000')
      .setTitle(result.success ? '✅ Thanh toán thành công' : '❌ Thanh toán thất bại')
      .setDescription(result.message)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[Violation Command] Error in confirm-payment:', error);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Có lỗi xảy ra khi xử lý thanh toán. Vui lòng thử lại sau.')
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else if (interaction.replied) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
