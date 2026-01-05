import {SlashCommandBuilder} from "discord.js";

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
                .setRequired(false)),
    async execute(interaction: any) {
        const input = interaction.options.getString('input');
        const channel = interaction.options.getChannel('channel');

        if (channel) {
            await channel.send(input);
            await interaction.reply({content: `Echoed your input to ${channel}.`, ephemeral: true});
        } else {
            await interaction.reply(input);
        }
    }
};