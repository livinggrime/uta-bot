import { SlashCommandBuilder } from "discord.js"

export default {
    aliases: ['p'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(context: any) {
        await context.reply('Pong!');
    }
};