import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getScheduleAuthorizedRoles } from '../../../database/schedule.js';
import { getScheduleForDate, ScheduleLoginRequiredError } from '../services/scheduleApi.js';

const timeBlocks = [
  [1, 3, '06:30 - 08:55'],
  [4, 6, '09:05 - 11:30'],
  [7, 9, '12:30 - 14:55'],
  [10, 12, '15:05 - 17:30'],
  [13, 15, '17:45 - 20:10']
];

export const data = new SlashCommandBuilder()
  .setName('lich-hoc')
  .setDescription('Xem lịch học và lịch thi theo ngày')
  .addStringOption(option =>
    option
      .setName('ngay')
      .setDescription('Ngày cần xem theo định dạng YYYY-MM-DD (mặc định là hôm nay)')
      .setMinLength(10)
      .setMaxLength(10)
  );

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
  const blocks = timeBlocks.filter(([first, last]) => end >= first && start <= last);
  const time = blocks.length
    ? `${blocks[0][2].split(' - ')[0]} - ${blocks.at(-1)[2].split(' - ')[1]}`
    : 'Chưa rõ giờ';
  return {
    label: `${time} · Tiết ${start}${end === start ? '' : `-${end}`}`,
    start
  };
}

function formatScheduleItem(item) {
  const period = getPeriod(item);
  const isExam = item.loaiLich === 2 || item.isLichHoc === false;
  const details = [
    `**${isExam ? 'Lịch thi' : 'Lịch học'} · ${period.label}**`,
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

export async function execute(interaction) {
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

  const date = interaction.options.getString('ngay') || getVietnamDate();
  if (!isValidDate(date)) {
    await interaction.editReply('Ngày không hợp lệ. Hãy nhập theo định dạng YYYY-MM-DD, ví dụ 2026-11-17.');
    return;
  }

  try {
    const schedule = await getScheduleForDate(interaction.user.id, date);
    if (schedule.length === 0) {
      await interaction.editReply(`Không có lịch học hoặc lịch thi ngày **${date}**.`);
      return;
    }

    const items = schedule
      .map(formatScheduleItem)
      .sort((left, right) => left.start - right.start);
    let description = '';
    let displayed = 0;
    for (const item of items) {
      const next = `${description ? '\n\n' : ''}${item.text}`;
      if (description.length + next.length > 3900) break;
      description += next;
      displayed++;
    }
    if (displayed < items.length) {
      description += `\n\nCòn ${items.length - displayed} lịch khác không thể hiển thị trong một tin nhắn.`;
    }

    const embed = new EmbedBuilder()
      .setColor('#2463a6')
      .setTitle(`Lịch học ngày ${date.split('-').reverse().join('/')}`)
      .setDescription(description);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    if (error instanceof ScheduleLoginRequiredError) {
      await interaction.editReply(error.message);
      return;
    }
    throw error;
  }
}
