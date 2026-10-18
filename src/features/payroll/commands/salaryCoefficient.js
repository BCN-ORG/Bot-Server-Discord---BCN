import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { setCoefficientForRole, getCoefficientByRole, getAllCoefficients, deleteCoefficientForRole } from '../../../database/payroll.js';

/**
 * Dinh nghia lenh /salary-coefficient
 */
export const data = new SlashCommandBuilder()
  .setName('salary-coefficient')
  .setDescription('Quan ly he so luong cho cac role')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Dat he so luong cho role')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role can dat he so')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('coefficient')
          .setDescription('He so luong (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('get')
      .setDescription('Xem he so luong cua role')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role can xem')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sach he so luong')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Xoa he so luong cua role (se dung mac dinh la 1)')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role can xoa')
          .setRequired(true)
      )
  );

/**
 * Xu ly lenh /salary-coefficient
 * @param {CommandInteraction} interaction 
 */
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'set') {
      await handleSet(interaction);
    } else if (subcommand === 'get') {
      await handleGet(interaction);
    } else if (subcommand === 'list') {
      await handleList(interaction);
    } else if (subcommand === 'delete') {
      await handleDelete(interaction);
    }
  } catch (error) {
    console.error('[ERROR] Salary coefficient command error:', error);
    
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
 * Xu ly subcommand set
 */
async function handleSet(interaction) {
  const role = interaction.options.getRole('role');
  const coefficient = interaction.options.getInteger('coefficient');

  await setCoefficientForRole(role.id, role.name, coefficient, interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor('#00b300')
    .setTitle('Da cap nhat he so luong')
    .addFields(
      { name: 'Role', value: `${role}`, inline: true },
      { name: 'He so', value: `${coefficient}`, inline: true }
    )
    .setFooter({ text: `Cap nhat boi ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Xu ly subcommand get
 */
async function handleGet(interaction) {
  const role = interaction.options.getRole('role');
  const coefData = await getCoefficientByRole(role.id);

  const coefficient = coefData ? coefData.coefficient : 1; // Mac dinh la 1
  const isDefault = !coefData;

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('He so luong')
    .addFields(
      { name: 'Role', value: `${role}`, inline: true },
      { name: 'He so', value: `${coefficient}${isDefault ? ' (mac dinh)' : ''}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Xu ly subcommand list
 */
async function handleList(interaction) {
  const coefficients = await getAllCoefficients();

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Danh sach he so luong')
    .setDescription(coefficients.length === 0 ? 'Chua co role nao duoc cau hinh' : `Co ${coefficients.length} role duoc cau hinh`);

  if (coefficients.length > 0) {
    // Sap xep theo coefficient giam dan
    coefficients.sort((a, b) => b.coefficient - a.coefficient);

    // Tao list
    const list = coefficients.map(c => 
      `**${c.roleName}**: ${c.coefficient} coins`
    ).join('\n');

    embed.addFields({ name: 'He so', value: list });
  }

  embed.addFields({ name: 'Luu y', value: 'Cac role khong co trong danh sach se dung he so mac dinh la **1**' });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Xu ly subcommand delete
 */
async function handleDelete(interaction) {
  const role = interaction.options.getRole('role');
  const deleted = await deleteCoefficientForRole(role.id);

  const embed = new EmbedBuilder()
    .setColor(deleted ? '#00b300' : '#ff9900')
    .setTitle(deleted ? 'Da xoa he so' : 'Khong tim thay')
    .setDescription(deleted ? `Role ${role} se dung he so mac dinh la 1` : `Role ${role} khong co trong danh sach`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
