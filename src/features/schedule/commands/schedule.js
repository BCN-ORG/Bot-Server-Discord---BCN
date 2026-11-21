import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getScheduleAuthorizedRoles } from '../../../database/schedule.js';
import { getScheduleForDate, ScheduleLoginRequiredError } from '../services/scheduleApi.js';

export const data = new SlashCommandBuilder()
  .setName('lich-hoc')
  .setDescription('Xem lịch học và lịch thi theo tuần');

export function getVietnamDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
  const lecturer = getDetail(item, 'Giảng viên');
  const group = getDetail(item, 'Nhóm');
  const note = getDetail(item, 'Ghi chú');
  if (lecturer) details.push(`Giảng viên: ${lecturer}`);
  if (group) details.push(`Nhóm: ${group}`);
  if (item.isTamNgung) details.push('Trạng thái: Tạm ngưng');
  if (note) details.push(`Ghi chú: ${note}`);
  return { start: period.start, text: details.join('\n') };
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday (0), go back 6 days, otherwise go to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getVietnameseDayName(dayOfWeek) {
  const names = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return names[dayOfWeek];
}

async function fetchWeekSchedule(userId, mondayDate) {
  const promises = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(mondayDate);
    date.setDate(date.getDate() + i);
    const dateStr = formatDateYYYYMMDD(date);
    promises.push(
      getScheduleForDate(userId, dateStr)
        .then(schedule => ({ date, schedule }))
        .catch(error => {
          // Re-throw login errors immediately
          if (error instanceof ScheduleLoginRequiredError) {
            throw error;
          }
          // For other errors, return empty schedule
          return { date, schedule: [] };
        })
    );
  }
  return Promise.all(promises);
}

function buildWeekEmbed(weekData, mondayDateStr) {
  let description = '';
  let hasAnySchedule = false;

  for (const { date, schedule } of weekData) {
    const dayName = getVietnameseDayName(date.getDay());
    const dateFormatted = formatDateDDMMYYYY(date);
    description += `**${dayName} - ${dateFormatted}**\n`;

    if (schedule.length === 0) {
      description += 'Không có lịch\n\n';
    } else {
      hasAnySchedule = true;
      const items = schedule
        .map(formatScheduleItem)
        .sort((left, right) => left.start - right.start);
      
      for (const item of items) {
        description += `${item.text}\n\n`;
      }
    }
  }

  const monday = new Date(mondayDateStr);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const title = `Lịch học tuần ${formatDateDDMMYYYY(monday)} - ${formatDateDDMMYYYY(sunday)}`;

  const embed = new EmbedBuilder()
    .setColor('#2463a6')
    .setTitle(title)
    .setDescription(description.trim());

  return embed;
}

function buildNavigationButtons(mondayDateStr, disabled = false) {
  const monday = new Date(mondayDateStr);
  
  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevMondayStr = formatDateYYYYMMDD(prevMonday);
  
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextMondayStr = formatDateYYYYMMDD(nextMonday);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`schedule_prev_${prevMondayStr}`)
      .setLabel('◀️ Tuần trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`schedule_next_${nextMondayStr}`)
      .setLabel('▶️ Tuần sau')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );

  return row;
}

export async function execute(interaction) {
  // Handle button interactions
  if (interaction.isButton() && interaction.customId.startsWith('schedule_')) {
    const mondayDateStr = interaction.customId.split('_')[2];
    
    if (!isValidDate(mondayDateStr)) {
      await interaction.reply({ content: 'Dữ liệu không hợp lệ.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Get current embed to preserve during loading
    const currentEmbed = interaction.message.embeds[0];
    
    // Disable both buttons and show loading spinner on clicked button
    const disabledButtons = buildNavigationButtons(mondayDateStr, true);
    await interaction.update({ embeds: [currentEmbed], components: [disabledButtons] });
    
    try {
      const weekData = await fetchWeekSchedule(interaction.user.id, mondayDateStr);
      const embed = buildWeekEmbed(weekData, mondayDateStr);
      const buttons = buildNavigationButtons(mondayDateStr, false);
      
      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (error) {
      if (error instanceof ScheduleLoginRequiredError) {
        await interaction.editReply({ content: error.message, embeds: [], components: [] });
        return;
      }
      throw error;
    }
    return;
  }

  // Handle slash command
  if (!interaction.inGuild() || !interaction.member) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng được trong máy chủ.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const allowedRoles = await getScheduleAuthorizedRoles(interaction.guildId);
  const hasAccess = allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
  if (!hasAccess) {
    await interaction.editReply('Bạn cần có ít nhất một role được cấp quyền xem lịch học.');
    return;
  }

  try {
    // Get Monday of current week
    const today = getVietnamDate();
    const todayDate = new Date(`${today}T00:00:00Z`);
    const monday = getMondayOfWeek(todayDate);
    const mondayDateStr = formatDateYYYYMMDD(monday);

    const weekData = await fetchWeekSchedule(interaction.user.id, mondayDateStr);
    const embed = buildWeekEmbed(weekData, mondayDateStr);
    const buttons = buildNavigationButtons(mondayDateStr);

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  } catch (error) {
    if (error instanceof ScheduleLoginRequiredError) {
      await interaction.editReply(error.message);
      return;
    }
    throw error;
  }
}
