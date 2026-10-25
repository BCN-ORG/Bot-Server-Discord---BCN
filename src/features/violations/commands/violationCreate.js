import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isUserAuthorized, createViolationWithNotification } from '../services/violationService.js';

export const data = new SlashCommandBuilder()
  .setName('violation-create')
  .setDescription('Tạo biên bản phạt cho một user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User cần lập biên bản phạt')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Lý do phạt')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Số tiền phạt (coins)')
      .setMinValue(1)
      .setRequired(true)
  );

export async function execute(interaction) {
  try {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const amount = interaction.options.getInteger('amount');
    const executor = interaction.member;
    const guild = interaction.guild;

    // Check if executor is authorized
    const authorized = await isUserAuthorized(guild.id, executor.id, executor);

    if (!authorized) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Không có quyền')
        .setDescription('Bạn không có quyền lập biên bản phạt.\n\nChỉ các role được phép mới có thể sử dụng lệnh này.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Defer reply for long operation
    await interaction.deferReply({ ephemeral: true });

    // Create violation with notifications
    const violation = await createViolationWithNotification({
      guild,
      targetUser,
      reason,
      amount,
      createdBy: executor.id
    });

    // Reply to executor
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Đã tạo biên bản phạt')
      .setDescription(
        `Biên bản phạt đã được tạo thành công!\n\n` +
        `**Mã biên bản:** \`${violation.violationId}\`\n` +
        `**Người bị phạt:** ${targetUser}\n` +
        `**Lý do:** ${reason}\n` +
        `**Số tiền:** ${amount} coins\n\n` +
        `✉️ Đã gửi thông báo đến ${targetUser.username}` +
        (violation.guildId ? '\n📢 Đã công khai thông báo' : '')
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[Violation Command] Error in create:', error);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Có lỗi xảy ra khi tạo biên bản phạt. Vui lòng thử lại sau.')
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
