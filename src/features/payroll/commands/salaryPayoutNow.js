import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { processWeeklyPayroll } from '../services/payrollService.js';

/**
 * Dinh nghia lenh /salary-payout-now
 */
export const data = new SlashCommandBuilder()
  .setName('salary-payout-now')
  .setDescription('Tra luong ngay lap tuc (khong can cho den lich)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Xu ly lenh /salary-payout-now
 * @param {CommandInteraction} interaction 
 * @param {Client} client 
 */
export async function execute(interaction, client) {
  try {
    // Defer reply vi qua trinh nay mat nhieu thoi gian
    await interaction.deferReply({ ephemeral: true });

    const startTime = Date.now();

    // Chay payroll
    const result = await processWeeklyPayroll(client);

    const duration = Date.now() - startTime;
    const durationSeconds = (duration / 1000).toFixed(1);

    // Neu tao no, hien thi thong bao khac
    if (result.debtCreated) {
      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('⚠️ Không đủ số dư — Đã ghi nợ')
        .setDescription('Không đủ số dư trong ví để trả lương. Một bản ghi nợ đã được tạo.')
        .addFields(
          { name: 'ID Nợ', value: `${result.debtId}`, inline: true },
          { name: 'Số người chịu ảnh hưởng', value: `${result.total}`, inline: true },
          { name: 'Tổng coins cần trả', value: `${result.totalNeeded}`, inline: true },
          { name: 'Số dư ví hiện tại', value: `${result.walletBalance}`, inline: true },
          { name: 'Số dư thiếu', value: `${result.deficit}`, inline: true },
          { name: 'Thời gian xử lý', value: `${durationSeconds}s`, inline: true }
        )
        .setFooter({ text: `Thực hiện bởi ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Tao embed ket qua
    const embed = new EmbedBuilder()
      .setTitle('Ket qua tra luong')
      .addFields(
        { name: 'Tong so nguoi', value: `${result.total}`, inline: true },
        { name: 'Thanh cong', value: `${result.success}`, inline: true },
        { name: 'That bai', value: `${result.failed}`, inline: true },
        { name: 'Bo qua', value: `${result.skipped}`, inline: true },
        { name: 'Da phat truoc do', value: `${result.alreadyPaid}`, inline: true },
        { name: 'Chua xu ly', value: `${result.unprocessed}`, inline: true },
        { name: 'Thoi gian xu ly', value: `${durationSeconds}s`, inline: true }
      )
      .setFooter({ text: `Thuc hien boi ${interaction.user.tag}` })
      .setTimestamp();

    // Xac dinh mau sac dua tren ket qua
    if (result.failed === 0 && result.unprocessed === 0 && result.total > 0) {
      embed.setColor('#00b300'); // Thanh cong hoan toan
    } else if ((result.failed > 0 && result.success > 0) || (result.failed === 0 && result.unprocessed > 0)) {
      embed.setColor('#ff9900'); // Co mot so loi
    } else if (result.failed > 0 && result.success === 0) {
      embed.setColor('#ff0000'); // That bai hoan toan
    } else {
      embed.setColor('#0099ff'); // Khong co gi de xu ly
    }

    // Them thong tin chi tiet neu can
    if (result.total === 0) {
      embed.setDescription('Khong co thanh vien nao duoc tra luong.\nVui long kiem tra:\n• Da them role vao danh sach tra luong?\n• Co thanh vien nao co role do khong?');
    } else if (result.failed > 0 || result.unprocessed > 0) {
      embed.setDescription(`Da dung dot tra luong do co loi. ${result.unprocessed} thanh vien phia sau chua duoc xu ly. Vui long kiem tra log truoc khi chay lai.`);
    } else if (result.success > 0) {
      embed.setDescription(`Da tra luong thanh cong cho ${result.success} thanh vien!`);
    } else if (result.alreadyPaid === result.total) {
      embed.setDescription('Tat ca thanh vien trong danh sach da duoc phat luong truoc do trong tuan nay.');
    } else if (result.skipped === result.total) {
      embed.setDescription('Tat ca thanh vien da duoc tra luong trong tuan nay hoac khong du dieu kien.');
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[ERROR] Salary payout now command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Loi')
      .setDescription(`Da xay ra loi khi tra luong:\n\`\`\`${error.message}\`\`\``)
      .addFields(
        { name: 'Giai phap', value: '• Kiem tra ket noi API\n• Kiem tra so du vi bot\n• Xem log de biet them chi tiet' }
      )
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
