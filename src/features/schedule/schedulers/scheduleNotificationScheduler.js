import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { getAllScheduleNotificationConfigs, getScheduleAuthorizedRoles, getScheduleCredentials } from '../../../database/schedule.js';
import { getScheduleForDate, ScheduleLoginRequiredError } from '../services/scheduleApi.js';

function getVietnamTime() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    dateFormatted: `${values.day}/${values.month}/${values.year}`
  };
}

function getDetail(item, label) {
  return item.chiTiets?.find(detail => detail.label?.trim().toLowerCase() === label.toLowerCase())?.value || '';
}

function getPeriod(item) {
  const rawPeriod = String(item.tietHocThi || getDetail(item, 'Tiết'));
  const match = rawPeriod.match(/(\d+)\s*[-–]\s*(\d+)/) || rawPeriod.match(/(\d+)/);
  if (!match) return { label: 'Chưa rõ giờ', start: Number.MAX_SAFE_INTEGER };

  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  return {
    label: `Tiết ${start}${end === start ? '' : `-${end}`}`,
    start
  };
}

function formatScheduleItem(item) {
  const period = getPeriod(item);
  const isExam = item.loaiLich === 2 || item.isLichHoc === false;
  const details = [
    `${isExam ? 'Lịch thi' : 'Lịch học'} · ${period.label}`,
    `Môn: ${item.tenMonHoc || 'Chưa có tên môn'}`,
    `Phòng: ${item.tenPhong || getDetail(item, 'Phòng') || 'Chưa có phòng'}`
  ];
  const group = getDetail(item, 'Nhóm');
  if (group) details.push(`Nhóm: ${group}`);
  return { start: period.start, text: details.join('\n') };
}

function buildScheduleEmbed(schedule, dateFormatted) {
  const items = schedule
    .map(formatScheduleItem)
    .sort((left, right) => left.start - right.start);

  const description = items.map(item => item.text).join('\n\n');

  return new EmbedBuilder()
    .setColor('#2463a6')
    .setTitle(`🔔 Lịch học hôm nay - ${dateFormatted}`)
    .setDescription(description)
    .setFooter({ text: 'Nhắc nhở lịch học tự động' })
    .setTimestamp();
}

async function sendScheduleNotifications(client) {
  try {
    const { date, time, dateFormatted } = getVietnamTime();
    
    // Get all guilds with notification enabled
    const configs = await getAllScheduleNotificationConfigs();
    
    for (const config of configs) {
      if (config.notificationTime !== time) {
        continue; // Skip if notification time doesn't match current time
      }

      const guild = client.guilds.cache.get(config.guildId);
      if (!guild) {
        console.warn(`[Schedule Notification] Guild ${config.guildId} not found`);
        continue;
      }

      // Get authorized roles
      const authorizedRoles = await getScheduleAuthorizedRoles(config.guildId);
      if (!authorizedRoles || authorizedRoles.length === 0) {
        console.log(`[Schedule Notification] No authorized roles configured for guild ${config.guildId}`);
        continue;
      }

      // Fetch all members with authorized roles
      const members = guild.members.cache;
      const eligibleMembers = new Set();

      for (const member of members.values()) {
        if (member.user.bot) continue;
        
        const hasAuthorizedRole = member.roles.cache.some(role =>
          authorizedRoles.includes(role.id)
        );
        
        if (hasAuthorizedRole) {
          eligibleMembers.add(member);
        }
      }

      console.log(`[Schedule Notification] Processing ${eligibleMembers.size} eligible members in guild ${guild.name}`);

      let sentCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const member of eligibleMembers) {
        try {
          // Check if user is logged in
          const credentials = await getScheduleCredentials(member.user.id);
          if (!credentials) {
            try {
              await member.send('Bạn chưa đăng nhập hệ thống lịch. Vui lòng dùng /lich-hoc-login để đăng nhập.');
              console.log(`[Schedule Notification] Sent login reminder to ${member.user.tag}`);
              skippedCount++;
            } catch (dmError) {
              console.warn(`[Schedule Notification] Cannot send login reminder to ${member.user.tag}: ${dmError.message}`);
              errorCount++;
            }
            continue;
          }

          // Get today's schedule
          const schedule = await getScheduleForDate(member.user.id, date);
          
          if (!schedule || schedule.length === 0) {
            skippedCount++;
            continue; // No schedule, skip without sending DM
          }

          // Build and send embed
          const embed = buildScheduleEmbed(schedule, dateFormatted);
          await member.send({ embeds: [embed] });
          sentCount++;
          console.log(`[Schedule Notification] Sent schedule to ${member.user.tag}`);

        } catch (error) {
          if (error instanceof ScheduleLoginRequiredError) {
            try {
              await member.send('Bạn cần đăng nhập lại bằng lệnh /lich-hoc-login.');
              console.log(`[Schedule Notification] Sent re-login reminder to ${member.user.tag}`);
              skippedCount++;
            } catch (dmError) {
              console.warn(`[Schedule Notification] Cannot send re-login reminder to ${member.user.tag}: ${dmError.message}`);
              errorCount++;
            }
          } else {
            errorCount++;
            console.warn(`[Schedule Notification] Error sending to ${member.user.tag}: ${error.message}`);
          }
        }
      }

      console.log(`[Schedule Notification] Guild ${guild.name} summary: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`);
    }
  } catch (error) {
    console.error('[ERROR] Schedule notification scheduler failed:', error);
  }
}

export function initScheduleNotificationScheduler(client) {
  // Run every minute to check if current time matches any notification time
  cron.schedule('* * * * *', async () => {
    await sendScheduleNotifications(client);
  }, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log('[INFO] Schedule notification scheduler started (runs every minute)');
}
