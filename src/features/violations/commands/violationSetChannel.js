import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { setAnnouncementChannel } from '../../../database/violations.js';

export const data = new SlashCommandBuilder()
  .setName('violation-set-channel')
  .setDescription('Cài đặt kênh công khai thông báo khi có người bị phạt')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Kênh để công khai khi có người bị phạt')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guild.id;

  try {
    // Validate channel is text-based
    if (!channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Vui lòng chọn một kênh text.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Set announcement channel
    await setAnnouncementChannel(guildId, channel.id);

    // Send test message to channel
    const testEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('✅ Kênh thông báo biên bản phạt')
      .setDescription('Kênh này đã được cài đặt để công khai thông báo khi có người bị phạt.')
      .setTimestamp();

    await channel.send({ embeds: [testEmbed] });

    // Reply to admin
    const successEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Đã cài đặt kênh thông báo')
      .setDescription(`Kênh ${channel} đã được cài đặt để công khai thông báo biên bản phạt.\n\nKhi có người bị lập biên bản phạt, bot sẽ gửi thông báo vào kênh này.`)
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });

  } catch (error) {
    console.error('[Violation Command] Error in set-channel:', error);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Có lỗi xảy ra khi cài đặt kênh. Vui lòng thử lại sau.')
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
