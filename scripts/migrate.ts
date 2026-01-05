import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import Guild from '../libs/models/Guild.ts';
import User from '../libs/models/User.ts';
import { connectToDatabase } from '../libs/database.ts';
import { fileURLToPath } from 'node:url';

const GUILDS_FILE = path.join(process.cwd(), 'guild-settings.json');
const USERS_FILE = path.join(process.cwd(), 'lastfm-users.json');

async function migrate() {
    await connectToDatabase();

    // Migrate Guilds
    if (fs.existsSync(GUILDS_FILE)) {
        console.log('Migrating guilds...');
        const guildsData = JSON.parse(fs.readFileSync(GUILDS_FILE, 'utf-8'));
        for (const [guildId, settings] of Object.entries(guildsData)) {
            await Guild.findOneAndUpdate(
                { guildId },
                { $set: { prefix: (settings as any).prefix } },
                { upsert: true }
            );
            console.log(`Migrated guild: ${guildId}`);
        }
    }

    // Migrate Users
    if (fs.existsSync(USERS_FILE)) {
        console.log('Migrating users...');
        const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        for (const [discordUserId, data] of Object.entries(usersData)) {
            const userData = data as any;
            await User.findOneAndUpdate(
                { discordUserId },
                {
                    $set: {
                        username: userData.username,
                        sessionKey: userData.sessionKey,
                        authorizedAt: userData.authorizedAt,
                    }
                },
                { upsert: true }
            );
            console.log(`Migrated user: ${discordUserId}`);
        }
    }

    console.log('Migration completed!');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
