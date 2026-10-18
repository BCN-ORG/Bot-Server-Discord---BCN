import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { validateName } from './validate.js';
import { checkMemberNickname, handleValidNickname } from '../../services/nameValidationService.js';

/**
 * Tao modal form nhap ho ten
 */
export function createRenameModal() {
  const modal = new ModalBuilder()
    .setCustomId('rename_modal')
    .setTitle('Đổi tên trên máy chủ');

  const nameInput = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('Họ và tên đầy đủ (VD: Nguyen Minh Vu)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Nguyễn Văn A')
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);

  const actionRow = new ActionRowBuilder().addComponents(nameInput);
  modal.addComponents(actionRow);

  return modal;
}

/**
 * Xu ly submit modal va doi nickname
 * @param {ModalSubmitInteraction} interaction
 */
export async function handleModalSubmit(interaction) {
  try {
    // Lay ho ten tu form
    const newName = interaction.fields.getTextInputValue('new_name');

    // Validate ho ten
    const validation = validateName(newName);
    if (!validation.valid) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Tên không hợp lệ')
        .setDescription(validation.error)
        .addFields(
          { name: '✅ Ví dụ hợp lệ', value: '`Nguyễn Minh Vũ`\n`Trần Thị Lan Anh`', inline: false }
        )
        .setFooter({ text: 'Vui lòng thử lại bằng lệnh /rename' });

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
      });
      return;
    }

    // Doi nickname
    await interaction.member.setNickname(validation.normalized);

    // Dong vi pham neu co
    await handleValidNickname(interaction.member);

    // Thong bao thanh cong
    const successEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Đặt tên thành công!')
      .setDescription(`Tên của bạn trong server: **${validation.normalized}**`)
      .setFooter({ text: 'Chào mừng bạn!' })
      .setTimestamp();

    await interaction.reply({
      embeds: [successEmbed],
      ephemeral: true
    });

  } catch (error) {
    console.error('[ERROR] Loi khi doi ten:', error);
    
    // Xu ly loi phan quyen
    if (error.code === 50013) {
      const permissionEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('⚠️ Không có quyền')
        .setDescription('Bot không có quyền đổi tên cho bạn!')
        .addFields(
          { 
            name: 'Nguyên nhân có thể là:', 
            value: '• Vai trò của bạn cao hơn vai trò của bot\n• Bạn là chủ server (bot không thể đổi tên chủ server)', 
            inline: false 
          }
        )
        .setFooter({ text: 'Vui lòng liên hệ quản trị viên để được hỗ trợ' });

      await interaction.reply({
        embeds: [permissionEmbed],
        ephemeral: true
      });
    } else {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Đã xảy ra lỗi')
        .setDescription('Không thể đặt tên. Vui lòng thử lại sau hoặc liên hệ quản trị viên!')
        .setFooter({ text: 'Lỗi hệ thống' });

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
      });
    }
  }
}
