import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { runViolationCheckNow } from './src/schedulers/violationChecker.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', async () => {
  console.log('[TEST] Bot ready, running violation check now...');
  
  try {
    await runViolationCheckNow(client);
    console.log('[TEST] Check completed!');
  } catch (error) {
    console.error('[TEST] Error:', error);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
