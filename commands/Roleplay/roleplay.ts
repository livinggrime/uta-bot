import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('roleplay')
        .setDescription('Roleplay commands'),
    cooldown: 5,
    async execute(context: any) {
        // Placeholder implementation
        return context.reply('🎭 Roleplay command coming soon!');
    }
};