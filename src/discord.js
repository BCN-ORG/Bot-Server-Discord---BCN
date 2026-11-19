import { REST, Routes, EmbedBuilder } from 'discord.js';
import renameFeature from './features/rename/index.js';
import * as schedulerFeature from './features/scheduler/index.js';
import * as payrollFeature from './features/payroll/index.js';
import * as reactionRolesFeature from './features/reactionRoles/index.js';
import * as temporaryRolesFeature from './features/temporaryRoles/index.js';
import * as kickManagerFeature from './features/kickManager/index.js';
import * as coinRandomFeature from './features/coinRandom/index.js';
import * as fineFeature from './features/fine/index.js';
import * as coinsFeature from './features/coins/index.js';
import * as systemMonitoringFeature from './features/system-monitoring/command.js';
import * as batteryAlertFeature from './features/system-monitoring/alertCommand.js';
import * as scheduleFeature from './features/schedule/commands/schedule.js';
import * as scheduleLoginFeature from './features/schedule/commands/login.js';
import * as scheduleRolesFeature from './features/schedule/commands/roles.js';
import {
  execute as kickExecute,
  executeRollback as kickRollbackExecute,
  data as kickData,
  rollbackData as kickRollbackData
} from './features/kickManager/kick.js';

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
    reactionRolesFeature.data.toJSON(),
    reactionRolesFeature.contextMenuData.toJSON(), // Context menu for reaction role
    temporaryRolesFeature.data.toJSON(),
    kickManagerFeature.data.toJSON(),
    coinRandomFeature.data.toJSON(),
    kickData.toJSON(),
    kickRollbackData.toJSON(),
    payrollFeature.salaryCoefficient.data.toJSON(),
    payrollFeature.salarySimpleRole.data.toJSON(),
    payrollFeature.salaryRoles.data.toJSON(),
    payrollFeature.salarySchedule.data.toJSON(),
    payrollFeature.salaryPayoutNow.data.toJSON(),
    payrollFeature.salaryNotificationSchedule.data.toJSON(),
    payrollFeature.salaryNotificationRoles.data.toJSON(),
    payrollFeature.salaryNotificationTest.data.toJSON(),
    payrollFeature.salaryDebts.data.toJSON(),
    payrollFeature.salaryDebtDetail.data.toJSON(),
    payrollFeature.salaryPayDebt.data.toJSON(),
    payrollFeature.salaryPreview.data.toJSON(),
    payrollFeature.salaryCheck.data.toJSON(),
    payrollFeature.salaryInfo.data.toJSON(),
    fineFeature.fineAuthorizedRoles.data.toJSON(),
    fineFeature.fineCreate.data.toJSON(),
    fineFeature.fineCheck.data.toJSON(),
    fineFeature.fineList.data.toJSON(),
    fineFeature.fineConfirmPayment.data.toJSON(),
    fineFeature.fineReminderTimes.data.toJSON(),
    fineFeature.fineAnnouncementChannels.data.toJSON(),
    fineFeature.fineDelete.data.toJSON(),
    coinsFeature.balance.data.toJSON(),
    coinsFeature.contribute.data.toJSON(),
    systemMonitoringFeature.data.toJSON(),
    batteryAlertFeature.data.toJSON(),
    scheduleFeature.data.toJSON(),
    scheduleLoginFeature.data.toJSON(),
    scheduleRolesFeature.data.toJSON()
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

      if (interaction.isChatInputCommand() && interaction.commandName === 'reaction-role') {
        await reactionRolesFeature.execute(interaction);
      }

      // Context menu for reaction role setup
      if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Setup Reaction Role') {
        await reactionRolesFeature.contextMenuExecute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'role') {
        await temporaryRolesFeature.execute(interaction);
      }

      // Fine system commands
      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-authorized-roles') {
        await fineFeature.fineAuthorizedRoles.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-create') {
        await fineFeature.fineCreate.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-check') {
        await fineFeature.fineCheck.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-list') {
        await fineFeature.fineList.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-confirm-payment') {
        await fineFeature.fineConfirmPayment.execute(interaction, client);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-reminder-times') {
        await fineFeature.fineReminderTimes.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-announcement-channels') {
        await fineFeature.fineAnnouncementChannels.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'fine-delete') {
        await fineFeature.fineDelete.execute(interaction, client);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'coins-balance') {
        await coinsFeature.balance.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'coins-contribute') {
        await coinsFeature.contribute.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'battery') {
        await systemMonitoringFeature.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'battery-alert-role') {
        await batteryAlertFeature.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'lich-hoc') {
        await scheduleFeature.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'lich-hoc-login') {
        await scheduleLoginFeature.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'lich-hoc-roles') {
        await scheduleRolesFeature.execute(interaction);
      }

      if (interaction.isButton() && interaction.customId.startsWith('schedule_')) {
        await scheduleFeature.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'kick-manager') {
        await kickManagerFeature.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'kick') {
        await kickExecute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'kick-rollback') {
        await kickRollbackExecute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'coin-random') {
        await coinRandomFeature.execute(interaction);
      }

      if (interaction.isButton() && interaction.customId.startsWith('coin_random:')) {
        await coinRandomFeature.handleRandomButton(interaction);
      }

      // Xu ly lenh /salary-coefficient
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-coefficient') {
        await payrollFeature.salaryCoefficient.execute(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-simple-role') {
        await payrollFeature.salarySimpleRole.execute(interaction);
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

      // Xu ly lenh /salary-notification-schedule
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-notification-schedule') {
        await payrollFeature.salaryNotificationSchedule.execute(interaction, client);
      }

      // Xu ly lenh /salary-notification-roles
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-notification-roles') {
        await payrollFeature.salaryNotificationRoles.execute(interaction);
      }

      // Xu ly lenh /salary-notification-test
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-notification-test') {
        await payrollFeature.salaryNotificationTest.execute(interaction, client);
      }

      // Xu ly lenh /salary-debts
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-debts') {
        await payrollFeature.salaryDebts.execute(interaction);
      }

      // Xu ly lenh /salary-debt-detail
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-debt-detail') {
        await payrollFeature.salaryDebtDetail.execute(interaction);
      }

      // Xu ly lenh /salary-pay-debt
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-pay-debt') {
        await payrollFeature.salaryPayDebt.execute(interaction);
      }

      // Xu ly lenh /salary-preview
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-preview') {
        await payrollFeature.salaryPreview.execute(interaction, client);
      }

      // Xu ly lenh /salary-check
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-check') {
        await payrollFeature.salaryCheck.execute(interaction);
      }

      // Xu ly lenh /salary-info
      if (interaction.isChatInputCommand() && interaction.commandName === 'salary-info') {
        await payrollFeature.salaryInfo.execute(interaction, client);
      }

      // Xu ly nut bam mo modal
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

      // Handle reaction role modal
      if (interaction.isModalSubmit() && interaction.customId.startsWith('reaction_role_modal:')) {
        await reactionRolesFeature.handleReactionRoleModal(interaction);
      }

      // Handle fine create modal
      if (interaction.isModalSubmit() && interaction.customId.startsWith('fine_create_modal:')) {
        await fineFeature.handleFineModalSubmit(interaction, client);
      }

      if (interaction.isModalSubmit() && interaction.customId === 'schedule_login_modal') {
        await scheduleLoginFeature.handleModalSubmit(interaction);
      }
    } catch (error) {
      if (error.code === 40060 || error.code === 10062) {
        console.warn(
          `[WARN] Discord không còn nhận phản hồi cho interaction (mã ${error.code}); ` +
          'hãy kiểm tra tiến trình bot trùng hoặc phản hồi quá hạn.'
        );
        return;
      }

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
