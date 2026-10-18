import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';

/**
 * Dinh nghia lenh /rename
 */
export const command = new SlashCommandBuilder()
  .setName('rename')
  .setDescription('Doi ten (nickname) cua ban trong server');

/**
 * Xu ly lenh /rename - gui thong bao voi nut bam
 * @param {CommandInteraction} interaction
 */
export async function execute(interaction) {
  // Tao nut bam de mo form
  const button = new ButtonBuilder()
    .setCustomId('open_rename_modal')
    .setLabel('Nhap ho va ten')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  // Tao embed
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('📝 Đổi tên hiển thị')
    .setDescription('Vui lòng đặt tên theo định dạng chuẩn')
    .addFields(
      { name: '✅ Ví dụ đúng', value: '`Nguyễn Minh Vũ`\n`Trần Thị Lan Anh`', inline: false },
      { name: '📋 Yêu cầu', value: '• Chỉ chứa chữ cái (có hoặc không dấu)\n• Có từ 1-5 từ\n• Không có số, emoji hoặc ký tự đặc biệt', inline: false }
    )
    .setFooter({ text: 'Bấm nút bên dưới để bắt đầu' })
    .setTimestamp();

  // Gui thong bao voi nut bam
  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

/**
 * Xu ly khi bam nut - mo modal
 * @param {ButtonInteraction} interaction
 * @param {ModalBuilder} modal
 */
export async function handleButtonClick(interaction, modal) {
  await interaction.showModal(modal);
}
