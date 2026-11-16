import cron from 'node-cron';
import {
  createBatteryEmbed,
  getBatteryAlertRoleIds,
  getBatteryInfo
} from './batteryService.js';

let hourlyReportJob = null;

async function sendHourlyBatteryReports(client) {
  const batteryInfo = await getBatteryInfo();

  if (batteryInfo.unsupportedPlatform) {
    console.warn('[Battery Alert] API pin chỉ hoạt động trên Android/Termux.');
    return;
  }

  if (!batteryInfo.battery) {
    console.warn('[Battery Alert] Không có dữ liệu pin để gửi báo cáo.');
    return;
  }

  const embed = createBatteryEmbed(batteryInfo);

  for (const guild of client.guilds.cache.values()) {
    try {
      const roleIds = await getBatteryAlertRoleIds(guild.id);
      if (roleIds.length === 0) continue;

      const configuredRoleIds = roleIds.filter(roleId => guild.roles.cache.has(roleId));
      if (configuredRoleIds.length !== roleIds.length) {
        console.warn(`[Battery Alert] Có role đã bị xóa khỏi guild ${guild.id}.`);
      }

      if (configuredRoleIds.length === 0) continue;

      const members = await guild.members.fetch();
      const recipients = [...members.values()].filter(member =>
        !member.user.bot
        && configuredRoleIds.some(roleId => member.roles.cache.has(roleId))
      );

      for (const member of recipients) {
        try {
          await member.send({ embeds: [embed] });
        } catch (error) {
          console.warn(
            `[Battery Alert] Không gửi được DM tới user ${member.id}:`,
            error.message
          );
        }
      }

      console.log(
        `[Battery Alert] Đã gửi báo cáo pin tới ${recipients.length} thành viên trong guild ${guild.id}.`
      );
    } catch (error) {
      console.error(`[Battery Alert] Lỗi xử lý guild ${guild.id}:`, error);
    }
  }
}

export function initBatteryAlertScheduler(client) {
  if (hourlyReportJob) hourlyReportJob.stop();

  hourlyReportJob = cron.schedule('0 * * * *', async () => {
    try {
      await sendHourlyBatteryReports(client);
    } catch (error) {
      console.error('[Battery Alert] Không thể gửi báo cáo pin hàng giờ:', error);
    }
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log('[Battery Alert] Báo cáo pin được lên lịch vào phút 00 mỗi giờ (Asia/Ho_Chi_Minh).');
}
