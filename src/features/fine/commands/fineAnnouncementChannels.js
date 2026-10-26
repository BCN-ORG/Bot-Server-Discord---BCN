import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import {
  getFineConfig,
  addAnnouncementChannel,
  removeAnnouncementChannel
} from '../../../database/fines.js';

export const data = new SlashCommandBuilder()
  .setName('fine-announcement-channels')
  .setDescription('Quản lý kênh thông báo công khai khi có biên bản phạt')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Thêm kênh thông báo')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Kênh cần thêm')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xóa kênh khỏi danh sách')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Kênh cần xóa')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sách kênh thông báo')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    if (subcommand === 'add') {
      const channel = interaction.options.getChannel('channel');
      
      await addAnnouncementChannel(guildId, channel.id);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Thêm Kênh Thành Công')
        .setDescription(
          `Đã thêm ${channel} vào danh sách kênh thông báo công khai\n` +
          `Khi có biên bản phạt mới, bot sẽ thông báo công khai tại kênh này.`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (subcommand === 'remove') {
      const channel = interaction.options.getChannel('channel');
      
      const success = await removeAnnouncementChannel(guildId, channel.id);

      if (success) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Xóa Kênh Thành Công')
          .setDescription(`Đã xóa ${channel} khỏi danh sách kênh thông báo`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Thông Báo')
          .setDescription(`Kênh ${channel} không có trong danh sách`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } else if (subcommand === 'list') {
      const config = await getFineConfig(guildId);

      if (config.announcementChannels.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('📋 Danh Sách Kênh Thông Báo')
          .setDescription('Chưa có kênh nào được cấu hình')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const channelList = config.announcementChannels
        .map(channelId => `<#${channelId}>`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Danh Sách Kênh Thông Báo Công Khai')
        .setDescription(
          `${channelList}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 Khi có biên bản phạt mới, bot sẽ thông báo công khai tại các kênh trên.`
        )
        .setFooter({ text: `Tổng: ${config.announcementChannels.length} kênh` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (error) {
    console.error('[Fine Announcement Channels] Error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}
