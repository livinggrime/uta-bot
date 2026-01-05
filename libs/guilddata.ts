import Guild, { IGuild } from './models/Guild';

export interface GuildSettings {
    prefix: string;
}

const DEFAULT_SETTINGS: GuildSettings = {
    prefix: '~',
};

/**
 * Loads all guild settings from the database.
 * @returns A record of guild settings keyed by Guild ID.
 */
export async function loadAllGuildSettings(): Promise<Record<string, GuildSettings>> {
    try {
        const guilds = await Guild.find({});
        const result: Record<string, GuildSettings> = {};
        for (const guild of guilds) {
            result[guild.guildId] = {
                prefix: guild.prefix,
            };
        }
        return result;
    } catch (error) {
        console.error('Error loading guild settings from DB:', error);
        return {};
    }
}

/**
 * Gets specific guild settings.
 * @param guildId The Discord Guild ID.
 */
export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
    try {
        const guild = await Guild.findOne({ guildId });
        if (!guild) return { ...DEFAULT_SETTINGS };
        return {
            prefix: guild.prefix,
        };
    } catch (error) {
        console.error(`Error fetching guild settings for ${guildId}:`, error);
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * Updates settings for a specific guild.
 * @param guildId The Discord Guild ID.
 * @param updates Partial settings updates.
 */
export async function updateGuildSettings(guildId: string, updates: Partial<GuildSettings>): Promise<void> {
    try {
        await Guild.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error(`Error updating guild settings for ${guildId}:`, error);
    }
}
