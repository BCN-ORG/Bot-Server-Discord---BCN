import { randomInt } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import {
  createCoinRandomEvent,
  disableCoinRandomEvent,
  enableCoinRandomEvent,
  expireCoinRandomEvents,
  failCoinRandomEvent,
  getCoinRandomEvent,
  recordCoinRandomResult,
  setCoinRandomEventMessage
} from '../../database/coinRandom.js';

const MAX_COINS_LIMIT = 2_147_483_647;
const MAX_DURATION_DAYS = 3650;

function createEventEmbed(event) {
  const active = event.status === 'ACTIVE';
  const statusLabel = active
    ? 'Đang hoạt động'
    : event.status === 'DISABLED'
      ? 'Đã vô hiệu hóa'
      : event.status === 'EXPIRED'
        ? 'Đã hết hạn'
        : 'Không hoạt động';
  const expirationTimestamp = event.expiresAt
    ? `<t:${Math.floor(new Date(event.expiresAt).getTime() / 1000)}:F>`
    : 'Không xác định';
  return new EmbedBuilder()
    .setColor(active ? 0xf1c40f : 0x808080)
    .setTitle('Sự kiện random coins')
    .setDescription(
      !active
        ? `Sự kiện này ${statusLabel.toLowerCase()}.\nMức tối đa: **${event.maxCoins} coins**.`
        : `Nhấn nút bên dưới để random số coins từ **1** đến **${event.maxCoins}**.\n` +
          'Mỗi thành viên chỉ được tham gia một lần. Kết quả hiển thị trong kênh; bot không chuyển coins.'
    )
    .addFields(
      { name: 'Trạng thái', value: statusLabel, inline: true },
      { name: 'Coins tối đa', value: `${event.maxCoins}`, inline: true },
      { name: 'Thời hạn', value: event.durationDays ? `${event.durationDays} ngày` : 'Không xác định', inline: true },
      { name: 'Kết thúc', value: expirationTimestamp, inline: false },
      { name: 'Người tạo', value: `<@${event.createdBy}>`, inline: true }
    )
    .setFooter({ text: `Sự kiện ID: ${event._id}` })
    .setTimestamp(event.createdAt);
}

function createEventComponents(eventId) {
  return createEventComponentsWithState(eventId, false);
}

function createEventComponentsWithState(eventId, disabled) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`coin_random:${eventId}`)
        .setLabel('Random coins')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎲')
        .setDisabled(disabled)
    )
  ];
}

export async function updateCoinRandomEventMessage(guild, event) {
  if (!event.channelId || !event.messageId) {
    return false;
  }
  const channel = await guild.channels.fetch(event.channelId);
  const message = await channel?.messages.fetch(event.messageId);
  if (!message) {
    return false;
  }
  await message.edit({
    embeds: [createEventEmbed(event)],
    components: createEventComponentsWithState(
      event._id.toString(),
      event.status !== 'ACTIVE'
    )
  });
  return true;
}

export async function processExpiredCoinRandomEvents(client) {
  const events = await expireCoinRandomEvents();
  for (const event of events) {
    try {
      const guild = await client.guilds.fetch(event.guildId);
      await updateCoinRandomEventMessage(guild, event);
    } catch (error) {
      console.error(`[ERROR] Failed to update expired coin random event ${event._id}:`, error);
    }
  }
}

export const data = new SlashCommandBuilder()
  .setName('coin-random')
  .setDescription('Tạo sự kiện random coins, không chuyển coins')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Tạo embed sự kiện random coins kèm nút tham gia')
      .addIntegerOption(option =>
        option
          .setName('max-coins')
          .setDescription('Số coins tối đa có thể random (kết quả từ 1 đến số này)')
          .setMinValue(1)
          .setMaxValue(MAX_COINS_LIMIT)
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('duration-days')
          .setDescription('Thời gian sự kiện hoạt động tính theo ngày')
          .setMinValue(1)
          .setMaxValue(MAX_DURATION_DAYS)
          .setRequired(true)
      )
  );

data.addSubcommand(subcommand =>
  subcommand
    .setName('disable')
    .setDescription('Vô hiệu hóa khẩn cấp một sự kiện random coins')
    .addStringOption(option =>
      option
        .setName('event-id')
        .setDescription('ID sự kiện hiển thị ở cuối embed')
        .setRequired(true)
    )
);

data.addSubcommand(subcommand =>
  subcommand
    .setName('enable')
    .setDescription('Kích hoạt lại sự kiện random còn thời hạn')
    .addStringOption(option =>
      option
        .setName('event-id')
        .setDescription('ID sự kiện hiển thị ở cuối embed')
        .setRequired(true)
    )
);

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) {
      throw new Error('Lệnh này chỉ dùng được trong server.');
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('Chỉ quản trị viên mới được quản lý sự kiện random coins.');
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'disable') {
      const eventId = interaction.options.getString('event-id', true).trim();
      const { event, alreadyDisabled } = await disableCoinRandomEvent(
        interaction.guild.id,
        eventId,
        interaction.user.id
      );
      if (!event) {
        throw new Error('Không tìm thấy sự kiện random có ID này trong máy chủ.');
      }
      if (event.status !== 'DISABLED') {
        if (event.status === 'EXPIRED') {
          await updateCoinRandomEventMessage(interaction.guild, event).catch(error => {
            console.error(`[ERROR] Failed to update expired coin random event ${event._id}:`, error);
          });
        }
        throw new Error(`Không thể vô hiệu hóa sự kiện đang ở trạng thái ${event.status}.`);
      }

      let messageUpdated = false;
      try {
        messageUpdated = await updateCoinRandomEventMessage(interaction.guild, event);
      } catch (error) {
        console.error(`[ERROR] Failed to update disabled coin random event ${event._id}:`, error);
      }

      await interaction.editReply(
        `${alreadyDisabled ? 'Sự kiện đã được vô hiệu hóa trước đó' : 'Đã vô hiệu hóa sự kiện random'} \`${event._id}\`. ` +
        (messageUpdated
          ? 'Đã cập nhật trạng thái và tắt nút trên tin nhắn gốc.'
          : 'Trạng thái đã được lưu nhưng không cập nhật được tin nhắn gốc.')
      );
      return;
    }

    if (subcommand === 'enable') {
      const eventId = interaction.options.getString('event-id', true).trim();
      const { event, outcome } = await enableCoinRandomEvent(
        interaction.guild.id,
        eventId,
        interaction.user.id
      );
      if (!event || outcome === 'NOT_FOUND') {
        throw new Error('Không tìm thấy sự kiện random có ID này trong máy chủ.');
      }
      if (outcome === 'EXPIRED') {
        await updateCoinRandomEventMessage(interaction.guild, event).catch(error => {
          console.error(`[ERROR] Failed to update expired coin random event ${event._id}:`, error);
        });
        throw new Error('Sự kiện đã hết hạn, không thể kích hoạt lại.');
      }
      if (outcome === 'NOT_ENABLEABLE') {
        throw new Error(`Không thể kích hoạt sự kiện đang ở trạng thái ${event.status}.`);
      }

      const messageUpdated = await updateCoinRandomEventMessage(
        interaction.guild,
        event
      ).catch(error => {
        console.error(`[ERROR] Failed to update enabled coin random event ${event._id}:`, error);
        return false;
      });
      await interaction.editReply(
        outcome === 'ALREADY_ACTIVE'
          ? `Sự kiện \`${event._id}\` đang hoạt động${messageUpdated ? ' và embed đã được đồng bộ lại.' : '.'}`
          : `Đã kích hoạt lại sự kiện \`${event._id}\`${messageUpdated ? ' và cập nhật embed gốc.' : ', nhưng không cập nhật được embed gốc.'}`
      );
      return;
    }

    const maxCoins = interaction.options.getInteger('max-coins', true);
    if (!Number.isSafeInteger(maxCoins) || maxCoins < 1 || maxCoins > MAX_COINS_LIMIT) {
      throw new Error(`Coins tối đa phải từ 1 đến ${MAX_COINS_LIMIT}.`);
    }
    const durationDays = interaction.options.getInteger('duration-days', true);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_DURATION_DAYS) {
      throw new Error(`Thời hạn phải từ 1 đến ${MAX_DURATION_DAYS} ngày.`);
    }
    if (!interaction.channel?.isTextBased() || !interaction.channel.send) {
      throw new Error('Không thể gửi sự kiện vào kênh hiện tại.');
    }

    const event = await createCoinRandomEvent({
      guildId: interaction.guild.id,
      channelId: interaction.channelId,
      createdBy: interaction.user.id,
      maxCoins,
      durationDays
    });

    try {
      const message = await interaction.channel.send({
        embeds: [createEventEmbed(event)],
        components: createEventComponents(event._id.toString())
      });
      await setCoinRandomEventMessage(event._id, message.id);
    } catch (error) {
      await failCoinRandomEvent(event._id, error.message);
      throw error;
    }

    await interaction.editReply({
      content: `Đã tạo sự kiện random coins trong <#${interaction.channelId}>. Không có coins nào được chuyển.`
    });
  } catch (error) {
    console.error('[ERROR] Failed to create coin random event:', error);
    const content = `Không thể tạo sự kiện random coins: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}

export async function handleRandomButton(interaction) {
  try {
    await interaction.deferUpdate();
    if (!interaction.guild) {
      throw new Error('Sự kiện random chỉ hoạt động trong server.');
    }
    if (interaction.user.bot) {
      throw new Error('Bot không thể tham gia sự kiện random.');
    }

    const eventId = interaction.customId.slice('coin_random:'.length);
    const event = await getCoinRandomEvent(interaction.guild.id, eventId);
    if (!event || event.channelId !== interaction.channelId
      || (event.messageId && event.messageId !== interaction.message.id)) {
      throw new Error('Sự kiện random này không tồn tại hoặc không còn hoạt động.');
    }

    const coins = randomInt(1, event.maxCoins + 1);
    const { result, alreadyReceived } = await recordCoinRandomResult({
      event,
      userId: interaction.user.id,
      coins
    });
    if (alreadyReceived) {
      await interaction.followUp({
        content: 'Bạn đã nhận kết quả từ sự kiện random này rồi.',
        ephemeral: true
      });
      return;
    }

    await interaction.followUp({
      content: `<@${interaction.user.id}> vừa nhận được **${result.coins} coin** từ hòm khi báu.`,
      allowedMentions: { users: [interaction.user.id] }
    });
  } catch (error) {
    console.error('[ERROR] Failed to process coin random button:', error);
    const content = `Không thể random coins: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}
