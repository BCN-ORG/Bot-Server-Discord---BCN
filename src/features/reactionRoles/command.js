import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
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
      .setDescription('Cấu hình reaction role')
      .addStringOption(option =>
        option
          .setName('message_id')
          .setDescription('ID tin nhắn (copy link → lấy số cuối)')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role sẽ được cấp khi react')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('emoji')
          .setDescription('Emoji (ví dụ: ❤️ hoặc :emoji_name:)')
          .setRequired(true)
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
      const messageId = interaction.options.getString('message_id', true).trim();
      const role = interaction.options.getRole('role', true);
      const emoji = interaction.options.getString('emoji', true).trim();

      // Tạo modal cho các options còn lại
      const modal = new ModalBuilder()
        .setCustomId(`reaction_role_modal:${messageId}:${role.id}:${encodeURIComponent(emoji)}`)
        .setTitle(`Setup ${role.name}`);

      const limitInput = new TextInputBuilder()
        .setCustomId('limit')
        .setLabel('Số người tối đa')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('10')
        .setRequired(true);

      const durationInput = new TextInputBuilder()
        .setCustomId('duration_or_every')
        .setLabel('Thời hạn (30 ngày hoặc 08:00)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('30 hoặc 08:00 (để trống = vĩnh viễn)')
        .setRequired(false);

      const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('Giá (coins)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0 = miễn phí')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(limitInput),
        new ActionRowBuilder().addComponents(durationInput),
        new ActionRowBuilder().addComponents(priceInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (subcommand === 'remove') {
      await interaction.deferReply({ flags: 64 });
      
      const messageId = interaction.options.getString('message_id', true).trim();
      const role = interaction.options.getRole('role', true);
      const roleId = role.id;
      const removed = await deleteConfig(interaction.guild, messageId, roleId);
      await interaction.editReply({
        content: removed
          ? `Đã xóa cấu hình role ${role} khỏi tin nhắn \`${messageId}\`.`
          : 'Không tìm thấy cấu hình tương ứng.'
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
        const priceText = config.price > 0 ? ` | giá: **${config.price}** coins` : '';
        return `• Tin nhắn \`${config.messageId}\` → <@&${config.roleId}> | ` +
          `emoji: \`${config.emojiLabel}\` | limit: **${config.limit}** | ` +
          `thời hạn: **${duration}**${priceText} | ` +
          `đã nhận: **${config.claimants?.length || 0}**`;
      }).join('\n')
      : 'Server chưa có cấu hình reaction role.';
    const suffix = configs.length > displayedConfigs.length
      ? `\n... và ${configs.length - displayedConfigs.length} cấu hình khác.`
      : '';

    await interaction.reply({
      content: `${content}${suffix}`.slice(0, 1900),
      flags: 64
    });
  } catch (error) {
    console.error('[ERROR] Reaction role command failed:', error);
    const message = `Không thể xử lý cấu hình reaction role: ${error.message}`;
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: message });
      } else if (interaction.replied) {
        await interaction.followUp({ content: message, flags: 64 });
      } else {
        await interaction.reply({ content: message, flags: 64 });
      }
    } catch (replyError) {
      console.error('[ERROR] Failed to send error message:', replyError);
    }
  }
}
