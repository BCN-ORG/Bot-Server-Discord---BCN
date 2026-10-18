import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { registerCommands, setupInteractionHandlers } from './discord.js';
import { handleGuildMemberAdd } from './events/guildMemberAdd.js';
import { handleGuildMemberUpdate } from './events/guildMemberUpdate.js';
import { handleVoiceStateUpdate } from './events/voiceStateUpdate.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { startViolationChecker } from './schedulers/violationChecker.js';
import { connectMongoDB } from './database/mongodb.js';
import { initPayrollScheduler } from './features/payroll/index.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

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
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Sự kiện khi bot sẵn sàng
client.once('ready', async () => {
  console.log(`[SUCCESS] Bot đã đăng nhập: ${client.user.tag}`);
  
  // Kết nối MongoDB
  try {
    await connectMongoDB();
  } catch (error) {
    console.error('[ERROR] Không thể kết nối MongoDB. Bot sẽ thoát.');
    process.exit(1);
  }
  
  // Đăng ký lệnh slash commands
  await registerCommands(DISCORD_TOKEN, CLIENT_ID, GUILD_ID);
  
  // Khởi động violation checker (quét theo lịch)
  startViolationChecker(client);
  
  // Khoi dong payroll scheduler
  await initPayrollScheduler(client);
  
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
