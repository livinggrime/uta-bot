import fs from 'node:fs';
import path from 'node:path';

const GUILDS_FILE = path.join(__dirname, '../guild-settings.json');

export interface GuildSettings {
    prefix: string;
}

const DEFAULT_SETTINGS: GuildSettings = {
    prefix: '!',
};

export function loadAllGuildSettings(): Record<string, GuildSettings> {
    try {
        if (!fs.existsSync(GUILDS_FILE)) {
            return {};
        }
        const data = fs.readFileSync(GUILDS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading guild settings:', error);
        return {};
    }
}

export function saveAllGuildSettings(settings: Record<string, GuildSettings>): void {
    try {
        fs.writeFileSync(GUILDS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving guild settings:', error);
    }
}

export function getGuildSettings(guildId: string): GuildSettings {
    const allSettings = loadAllGuildSettings();
    return allSettings[guildId] || { ...DEFAULT_SETTINGS };
}

export function updateGuildSettings(guildId: string, updates: Partial<GuildSettings>): void {
    const allSettings = loadAllGuildSettings();
    allSettings[guildId] = {
        ...(allSettings[guildId] || DEFAULT_SETTINGS),
        ...updates,
    };
    saveAllGuildSettings(allSettings);
}
