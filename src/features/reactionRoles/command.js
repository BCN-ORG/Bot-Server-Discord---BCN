import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import {
  deleteConfig,
  listConfigs,
  setConfig
} from './controller.js';

export const data = new SlashCommandBuilder()
  .setName('reaction-role')
  .setDescription('Cấu hình nhận role bằng reaction')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Tạo hoặc cập nhật cấu hình reaction role')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Kênh chứa tin nhắn')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('message_id')
          .setDescription('ID tin nhắn cần cấu hình')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role cấp khi thành viên react')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Số thành viên tối đa nhận role')
          .setMinValue(1)
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('emoji')
          .setDescription('Emoji cần react, hoặc all để chấp nhận mọi emoji')
          .setMaxLength(100)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('duration_days')
          .setDescription('Thời hạn role tính theo ngày; bỏ trống để không hết hạn')
          .setMinValue(1)
          .setMaxValue(36500)
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('every')
          .setDescription('Gỡ role lúc mấy giờ mỗi ngày (HH:mm, ví dụ: 08:20); conflict với duration_days')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xóa cấu hình reaction role')
      .addStringOption(option =>
        option
          .setName('message_id')
          .setDescription('ID tin nhắn')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Chọn role cần xóa khỏi cấu hình')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem cấu hình reaction role')
  );

export async function execute(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Bạn cần quyền Manage Roles để quản lý cấu hình này.');
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      const messageId = interaction.options.getString('message_id', true).trim();
      const role = interaction.options.getRole('role', true);
      const limit = interaction.options.getInteger('limit', true);
      const emoji = interaction.options.getString('emoji') || 'all';
      const durationDays = interaction.options.getInteger('duration_days');
      const every = interaction.options.getString('every');

      const result = await setConfig({
        guild: interaction.guild,
        channel,
        messageId,
        role,
        limit,
        emoji,
        durationDays,
        every
      });
      await interaction.reply({ content: result, ephemeral: true });
      return;
    }

    if (subcommand === 'remove') {
      const messageId = interaction.options.getString('message_id', true).trim();
      const role = interaction.options.getRole('role', true);
      const roleId = role.id;
      const removed = await deleteConfig(interaction.guild, messageId, roleId);
      await interaction.reply({
        content: removed
          ? `Đã xóa cấu hình role ${role} khỏi tin nhắn \`${messageId}\`.`
          : 'Không tìm thấy cấu hình tương ứng.',
        ephemeral: true
      });
      return;
    }

    const configs = await listConfigs(interaction.guild.id);
    const displayedConfigs = configs.slice(0, 20);
    const content = configs.length
      ? displayedConfigs.map(config => {
        let duration = 'không hết hạn';
        if (config.durationDays) duration = `${config.durationDays} ngày`;
        else if (config.every) duration = `mỗi ngày lúc ${config.every}`;
        return `• Tin nhắn \`${config.messageId}\` → <@&${config.roleId}> | ` +
          `emoji: \`${config.emojiLabel}\` | limit: **${config.limit}** | ` +
          `thời hạn: **${duration}** | ` +
          `đã nhận: **${config.claimants?.length || 0}**`;
      }).join('\n')
      : 'Server chưa có cấu hình reaction role.';
    const suffix = configs.length > displayedConfigs.length
      ? `\n... và ${configs.length - displayedConfigs.length} cấu hình khác.`
      : '';

    await interaction.reply({
      content: `${content}${suffix}`.slice(0, 1900),
      ephemeral: true
    });
  } catch (error) {
    console.error('[ERROR] Reaction role command failed:', error);
    const message = `Không thể xử lý cấu hình reaction role: ${error.message}`;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
}
