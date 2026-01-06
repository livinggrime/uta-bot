import {ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder} from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName('echo')
        .setDescription('Replies with your input!')
        .addStringOption((option) =>
            option.setName('input')
                .setDescription('The input to echo back')
                .setRequired(true))
        .addChannelOption((option) =>
            option.setName('channel')
                .setDescription('The channel to echo the input to')
                .setRequired(false))
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ]),
    async execute(context: any) {
        const input = context.options.getString('input');
        const channel = context.options.getChannel('channel');

        if (channel) {
            await channel.send(input);
            await context.reply({ content: `Echoed your input to ${channel}.`, ephemeral: true });
        } else {
            await context.reply(input);
        }
    }
};