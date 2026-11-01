/**
 * /salary-notification-test command
 * Test gui notification ngay lap tuc (khong can cho den lich)
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getSalaryNotificationConfig } from '../../../database/payroll.js';
import { generatePayrollPreview } from '../services/payrollNotificationService.js';

/**
 * Dinh nghia lenh /salary-notification-test
 */
export const data = new SlashCommandBuilder()
  .setName('salary-notification-test')
  .setDescription('Test gui thong bao tra luong ngay lap tuc (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Gui notification embed
 * @param {Client} client
 * @param {Object} previewData
 * @param {Array<string>} notificationRoleIds
 * @param {TextChannel} targetChannel - Channel de gui (tu interaction)
 */
async function sendTestNotification(client, previewData, notificationRoleIds, targetChannel) {
  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error('GUILD_ID not found in .env');
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Tao embed thong bao
    const embed = new EmbedBuilder()
      .setColor(previewData.deficit > 0 ? '#ff9900' : '#00b300')
      .setTitle('🔔 Bao cao tra luong sap toi [TEST]')
      .setDescription('Du toan tra luong cho ky tiep theo');

    // Them thong tin ngay tra luong
    if (previewData.nextPayrollDate) {
      const dateStr = previewData.nextPayrollDate.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      embed.addFields({ name: '📅 Thoi gian tra luong tiep theo', value: dateStr, inline: false });
    }

    // Them thong tin coins
    embed.addFields(
      { name: '👥 So thanh vien', value: previewData.memberCount.toString(), inline: true },
      { name: '💰 Tong coins can tra', value: previewData.totalCoinsNeeded.toString(), inline: true },
      { name: '🧾 Luong co dinh trong tong', value: previewData.fixedSalaryCoins.toString(), inline: true },
      { name: '🏦 So du hien tai', value: previewData.currentBalance.toString(), inline: true }
    );

    // Them thong tin thieu hut neu co
    if (previewData.deficit > 0) {
      embed.addFields({
        name: '⚠️ So du thieu',
        value: `**${previewData.deficit}** coins\n_Can nap them de dam bao tra du luong_`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '✅ Trang thai',
        value: 'So du du de tra luong',
        inline: false
      });
    }

    embed.setFooter({ text: 'TEST - He thong tu dong bao cao' });
    embed.setTimestamp();

    // Gui thong bao trong channel (khong tag)
    await targetChannel.send({
      embeds: [embed]
    });

    // Gui DM rieng cho tung admin co role
    let dmCount = 0;
    let dmFailed = 0;

    if (notificationRoleIds && notificationRoleIds.length > 0) {
      const members = guild.members.cache;
      const notifiedUsers = new Set();

      for (const member of members.values()) {
        if (member.user.bot) continue;

        const hasNotificationRole = member.roles.cache.some(role =>
          notificationRoleIds.includes(role.id)
        );

        if (hasNotificationRole) {
          notifiedUsers.add(member);
        }
      }

      // Gui DM cho tung user
      for (const member of notifiedUsers) {
        try {
          await member.send({
            content: '📢 **[TEST] Thông báo trả lương sắp tới**',
            embeds: [embed]
          });
          dmCount++;
          console.log(`[Payroll Notification Test] Sent DM to ${member.user.tag}`);
        } catch (error) {
          dmFailed++;
          console.warn(`[WARN] Cannot send DM to ${member.user.tag}: ${error.message}`);
        }
      }
    }

    console.log(`[Payroll Notification Test] DM summary: ${dmCount} sent, ${dmFailed} failed`);

    return {
      success: true,
      channelName: targetChannel.name,
      notifiedCount: dmCount,
      failedCount: dmFailed
    };

  } catch (error) {
    console.error('[ERROR] Failed to send test notification:', error);
    throw error;
  }
}

/**
 * Xu ly lenh /salary-notification-test
 * @param {CommandInteraction} interaction
 * @param {Client} client
 */
export async function execute(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Lay config notification
    const notificationConfig = await getSalaryNotificationConfig();

    // Generate preview data
    const previewData = await generatePayrollPreview(client);

    // Gui test notification vao channel hien tai
    const result = await sendTestNotification(
      client,
      previewData,
      notificationConfig.notificationRoles || [],
      interaction.channel
    );

    // Tao embed xac nhan
    const confirmEmbed = new EmbedBuilder()
      .setColor('#00b300')
      .setTitle('✅ Da gui test notification')
      .addFields(
        { name: 'Channel', value: `#${result.channelName}`, inline: true },
        { name: 'So nguoi duoc tag', value: result.notifiedCount.toString(), inline: true }
      )
      .setDescription('Kiem tra channel de xem notification')
      .setTimestamp();

    if (notificationConfig.notificationRoles && notificationConfig.notificationRoles.length > 0) {
      const roleList = notificationConfig.notificationRoles.map(id => `<@&${id}>`).join(', ');
      confirmEmbed.addFields({
        name: 'Roles duoc thong bao',
        value: roleList,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [confirmEmbed] });

  } catch (error) {
    console.error('[ERROR] Salary notification test command error:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Loi')
      .setDescription(`Khong the gui test notification:\n\`\`\`${error.message}\`\`\``)
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
