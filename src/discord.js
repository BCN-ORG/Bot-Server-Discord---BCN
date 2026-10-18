import { REST, Routes, EmbedBuilder } from 'discord.js';
import renameFeature from './features/rename/index.js';
import * as schedulerFeature from './features/scheduler/index.js';
import * as payrollFeature from './features/payroll/index.js';

/**
 * Dang ky lenh slash commands voi Discord
 * @param {string} token - Bot token
 * @param {string} clientId - Application ID
 * @param {string} guildId - Guild (Server) ID
 */
export async function registerCommands(token, clientId, guildId) {
  const commands = [
    renameFeature.command.toJSON(),
    schedulerFeature.data.toJSON(),
    payrollFeature.salaryCoefficient.data.toJSON(),
    payrollFeature.salaryRoles.data.toJSON(),
    payrollFeature.salarySchedule.data.toJSON(),
    payrollFeature.salaryPayoutNow.data.toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('[INFO] Dang dang ky lenh slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log('[SUCCESS] Da dang ky lenh thanh cong!');
  } catch (error) {
    console.error('[ERROR] Loi khi dang ky lenh:', error);
  }
}

/**
 * Xu ly cac tuong tac (commands, buttons, modals)
 * @param {Client} client - Discord client
 */
export function setupInteractionHandlers(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      // Xu ly lenh /rename
      if (interaction.isChatInputCommand() && interaction.commandName === 'rename') {
        await renameFeature.execute(interaction);
      }

      // Xu ly lenh /scheduler
      if (interaction.isChatInputCommand() && interaction.commandName === 'scheduler') {
        await schedulerFeature.execute(interaction);
      }

      // Xu ly lenh /salary-coefficient
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-coefficient') {
        await payrollFeature.salaryCoefficient.execute(interaction);
      }

      // Xu ly lenh /salary-roles
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-roles') {
        await payrollFeature.salaryRoles.execute(interaction);
      }

      // Xu ly lenh /salary-schedule
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-schedule') {
        await payrollFeature.salarySchedule.execute(interaction, client);
      }

      // Xu ly lenh /salary-payout-now
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-payout-now') {
        await payrollFeature.salaryPayoutNow.execute(interaction, client);
      }

      // Xu ly nut bam mthêmo modal
      if (interaction.isButton() && interaction.customId === 'open_rename_modal') {
        const modal = renameFeature.createRenameModal();
        await renameFeature.handleButtonClick(interaction, modal);
      }

      // Xu ly nut "De sau"
      if (interaction.isButton() && interaction.customId === 'violation_later') {
        const laterEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Lưu ý')
          .setDescription('Bạn vẫn có hạn **48 giờ** kể từ khi nhận được thông báo đầu tiên.')
          .addFields(
            { 
              name: '⏰ Quan trọng', 
              value: 'Vui lòng sửa tên trước khi hết hạn để tránh bị kick khỏi server.', 
              inline: false 
            },
            { 
              name: '💡 Mẹo', 
              value: 'Bạn có thể dùng lệnh `/rename` bất cứ lúc nào.', 
              inline: false 
            }
          );

        await interaction.reply({
          embeds: [laterEmbed],
          ephemeral: true
        });
      }

      // Xu ly submit modal
      if (interaction.isModalSubmit() && interaction.customId === 'rename_modal') {
        await renameFeature.handleModalSubmit(interaction);
      }
    } catch (error) {
      console.error('[ERROR] Loi khi xu ly interaction:', error);
      
      // Phan hoi loi cho nguoi dung
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
        .setFooter({ text: 'Lỗi hệ thống' });

      const errorMessage = {
        embeds: [errorEmbed],
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  });
}
