import { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { checkMemberNickname } from '../services/nameValidationService.js';

/**
 * Xu ly khi member moi vao server
 * Kiem tra ten va gui thong bao huong dan nhap ho ten
 */
export async function handleGuildMemberAdd(member) {
  try {
    // Kiem tra nickname ngay khi vao
    const { valid, nickname } = await checkMemberNickname(member);

    if (!valid) {
      // Tên sai - gửi thông báo hướng dẫn đổi tên (không tạo violation nữa)
      console.log(`[INFO] New member ${member.user.tag} has invalid name`);
      
      // Send rename instructions via DM
      try {
        const button = new ButtonBuilder()
          .setCustomId('open_rename_modal')
          .setLabel('Đổi tên ngay')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Tên hiển thị không hợp lệ')
          .setDescription(
            `Chào mừng bạn đến với server!\n\n` +
            `Tên hiển thị của bạn (\`${nickname}\`) không hợp lệ.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📋 **Quy định đặt tên:**\n` +
            `• Họ và tên đầy đủ (2-5 từ)\n` +
            `• Viết hoa chữ cái đầu mỗi từ\n` +
            `• Chỉ dùng chữ cái (có dấu)\n` +
            `• Ví dụ: Nguyễn Văn A\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Vui lòng dùng lệnh \`/rename\` hoặc bấm nút bên dưới để đổi tên!`
          )
          .setTimestamp();

        await member.send({ embeds: [embed], components: [row] });
        console.log(`[INFO] Sent rename instructions to ${member.user.tag}`);
      } catch (error) {
        console.log('[INFO] Could not send DM (DM disabled)');
      }
    }

    // Gui thong bao chao mung vao kenh huong dan
    await sendWelcomeMessage(member);

  } catch (error) {
    console.error('[ERROR] Failed to handle guild member add:', error);
  }
}

/**
 * Gui thong bao chao mung vao kenh huong dan
 * @param {GuildMember} member 
 */
async function sendWelcomeMessage(member) {
  try {
    const welcomeChannel = member.guild.channels.cache.find(
      ch => ch.name === 'huong-dan' || ch.name === 'welcome' || ch.name === 'chao-mung'
    );

    if (!welcomeChannel) {
      console.log('[WARN] Khong tim thay kenh huong dan de gui thong bao');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Chao mung thanh vien moi!')
      .setDescription(
        `Chao mung ${member} den voi server!\n\n` +
        `**Vui long dat ten theo dinh dang:** Nguyen Minh Vu\n\n` +
        `**Yeu cau:**\n` +
        `- Chi chua chu cai (co hoac khong dau)\n` +
        `- Co tu 2-5 tu\n` +
        `- Khong co so, emoji hoac ky tu dac biet\n\n` +
        `**Han sua: 48 gio**\n` +
        `Neu khong sua dung ten, ban se bi kick khoi server.\n\n` +
        `Bam nut ben duoi de nhap ho ten:`
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Discord Bot' });

    const button = new ButtonBuilder()
      .setCustomId('open_rename_modal')
      .setLabel('Nhap ho va ten')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await welcomeChannel.send({
      content: `${member}`,
      embeds: [embed],
      components: [row]
    });

    console.log(`[INFO] Sent welcome message for ${member.user.tag}`);
  } catch (error) {
    console.error('[ERROR] Failed to send welcome message:', error);
  }
}
