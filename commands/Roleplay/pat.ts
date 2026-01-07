import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pat')
        .setDescription('Give someone a pat')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Who to pat')
                .setRequired(false)
        ),
    cooldown: 5,
    async execute(context: any) {
        // Placeholder implementation
        return context.reply('👋 Pat command coming soon!');
    }
};