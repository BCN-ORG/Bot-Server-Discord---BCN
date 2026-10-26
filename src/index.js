import express from 'express';
import cors from 'cors';
const app = express();
const PORT = process.env.PORT || 3000;
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { registerCommands, setupInteractionHandlers } from './discord.js';
import { handleGuildMemberAdd } from './events/guildMemberAdd.js';
import { handleGuildMemberUpdate } from './events/guildMemberUpdate.js';
import { handleVoiceStateUpdate } from './events/voiceStateUpdate.js';
import { handleMessageCreate } from './events/messageCreate.js';
import {
  handleReactionRoleAdd,
  handleReactionRoleMemberRemove,
  handleReactionRoleRemove,
  initReactionRoleScheduler
} from './features/reactionRoles/index.js';
import { initFineReminderScheduler } from './features/fine/index.js';
import { connectMongoDB } from './database/mongodb.js';
import { connectBCN } from './database/bcn.js';
import { initPayrollScheduler, initNotificationScheduler } from './features/payroll/index.js';
import { initTemporaryRoleScheduler } from './features/temporaryRoles/index.js';
import apiRoutes from './routes/index.js';
import { createApiKeyAuth } from './middleware/apiKeyAuth.js';
import { handleGuildMemberKick } from './features/kickManager/kick.js';
import { initCoinRandomScheduler } from './features/coinRandom/index.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

// Middleware
const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOrigin = corsOrigins.includes('*') ? '*' : corsOrigins;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/birthdays', createApiKeyAuth(process.env.API_KEYS));
app.use('/api', apiRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Discord Bot is active',
    timestamp: new Date().toISOString()
  });
});

// Kiểm tra biến môi trường
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('[ERROR] Thiếu biến môi trường! Vui lòng kiểm tra file .env');
  process.exit(1);
}

// Tạo Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

// Sự kiện khi bot sẵn sàng
client.once('ready', async () => {
  console.log(`[SUCCESS] Bot đã đăng nhập: ${client.user.tag}`);
  
  // Kết nối MongoDB (discord_bot database)
  try {
    await connectMongoDB();
    // Initialize fine indexes
    const { initFineIndexes } = await import('./database/fines.js');
    await initFineIndexes();
    // Initialize contribution indexes
    const { initContributionIndexes } = await import('./database/contributions.js');
    await initContributionIndexes();
  } catch (error) {
    console.error('[ERROR] Không thể kết nối MongoDB. Bot sẽ thoát.');
    process.exit(1);
  }
  
  // Kết nối BCN database (members collection)
  try {
    await connectBCN();
  } catch (error) {
    console.error('[ERROR] Không thể kết nối BCN database. Bot sẽ thoát.');
    process.exit(1);
  }
  
  // Đăng ký lệnh slash commands
  await registerCommands(DISCORD_TOKEN, CLIENT_ID, GUILD_ID);
  
  // Khởi động fine reminder scheduler
  await initFineReminderScheduler(client);
  
  // Khoi dong payroll scheduler
  await initPayrollScheduler(client);
  
  // Khoi dong notification scheduler
  await initNotificationScheduler(client);

  // Start the temporary-role expiry/recovery scheduler.
  await initTemporaryRoleScheduler(client);

  // Start the reaction-role expiry scheduler.
  await initReactionRoleScheduler(client);

  // Start the coin-random event expiry scheduler.
  await initCoinRandomScheduler(client);
  
  console.log('[INFO] Bot đang hoạt động!');
});

// Sự kiện khi member mới vào server
client.on('guildMemberAdd', handleGuildMemberAdd);

// Sự kiện khi member cập nhật thông tin (đổi nickname)
client.on('guildMemberUpdate', handleGuildMemberUpdate);

// Sự kiện khi member join/leave voice channel
client.on('voiceStateUpdate', handleVoiceStateUpdate);

// Sự kiện khi member gửi message
client.on('messageCreate', handleMessageCreate);
client.on('messageReactionAdd', handleReactionRoleAdd);
client.on('messageReactionRemove', handleReactionRoleRemove);
client.on('guildMemberRemove', handleReactionRoleMemberRemove);
client.on('guildMemberRemove', handleGuildMemberKick);

// Thiết lập xử lý tương tác
setupInteractionHandlers(client);

// Xử lý lỗi
client.on('error', (error) => {
  console.error('[ERROR] Lỗi Discord client:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[ERROR] Lỗi chưa được xử lý:', error);
});

// Đăng nhập bot
client.login(DISCORD_TOKEN);

// Start Express server
app.listen(PORT, () => {
  console.log(`[INFO] Express server đang chạy tại http://localhost:${PORT}`);
  console.log(`[INFO] API endpoints:`);
  console.log(`       - GET  http://localhost:${PORT}/api/health`);
  console.log(`       - GET  http://localhost:${PORT}/api/system`);
  console.log(`       - GET  http://localhost:${PORT}/api/birthdays/today`);
  console.log(`       - POST http://localhost:${PORT}/api/birthdays/by-date`);
});