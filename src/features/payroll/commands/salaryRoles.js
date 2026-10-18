import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { addEligibleRole, removeEligibleRole, getAllEligibleRoles } from '../../../database/payroll.js';

/**
 * Dinh nghia lenh /salary-roles
 */
export const data = new SlashCommandBuilder()
  .setName('salary-roles')
  .setDescription('Quan ly danh sach role duoc tra luong')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Them role vao danh sach duoc tra luong')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role can them')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xoa role khoi danh sach duoc tra luong')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role can xoa')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sach role duoc tra luong')
  );

/**
 * Xu ly lenh /salary-roles
 * @param {CommandInteraction} interaction 
 */
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'add') {
      await handleAdd(interaction);
    } else if (subcommand === 'remove') {
      await handleRemove(interaction);
    } else if (subcommand === 'list') {
      await handleList(interaction);
    }
  } catch (error) {
    console.error('[ERROR] Salary roles command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Loi')
      .setDescription('Da xay ra loi khi xu ly lenh');

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Xu ly subcommand add
 */
async function handleAdd(interaction) {
  const role = interaction.options.getRole('role');

  await addEligibleRole(role.id, role.name, interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor('#00b300')
    .setTitle('Da them role')
    .setDescription(`Role ${role} da duoc them vao danh sach tra luong`)
    .addFields(
      { name: 'Luu y', value: 'Thanh vien co role nay se duoc tra luong hang tuan theo lich' }
    )
    .setFooter({ text: `Them boi ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Xu ly subcommand remove
 */
async function handleRemove(interaction) {
  const role = interaction.options.getRole('role');
  const removed = await removeEligibleRole(role.id);

  const embed = new EmbedBuilder()
    .setColor(removed ? '#00b300' : '#ff9900')
    .setTitle(removed ? 'Da xoa role' : 'Khong tim thay')
    .setDescription(removed ? `Role ${role} da duoc xoa khoi danh sach tra luong` : `Role ${role} khong co trong danh sach`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Xu ly subcommand list
 */
async function handleList(interaction) {
  const eligibleRoles = await getAllEligibleRoles();

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Danh sach role duoc tra luong')
    .setDescription(eligibleRoles.length === 0 ? 'Chua co role nao trong danh sach' : `Co ${eligibleRoles.length} role duoc tra luong hang tuan`);

  if (eligibleRoles.length > 0) {
    // Tao list
    const list = eligibleRoles.map((r, index) => 
      `${index + 1}. **${r.roleName}** (ID: ${r.roleId})`
    ).join('\n');

    embed.addFields({ name: 'Cac role', value: list });
  }

  embed.addFields({ 
    name: 'Luu y', 
    value: 'Chi thanh vien co it nhat mot trong cac role tren moi duoc tra luong' 
  });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
