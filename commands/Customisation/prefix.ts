import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '../../libs/guilddata';

export default {
    aliases: ['setprefix'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('View or change the command prefix for this server')
        .addStringOption(option =>
            option.setName('new_prefix')
                .setDescription('The new prefix to set (e.g. !, ?, .)')
                .setRequired(false)
                .setMaxLength(5)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(context: any) {
        const newPrefix = context.options.getString('new_prefix');
        const guildId = context.guildId;

        if (!guildId) {
            return context.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        const currentSettings = await getGuildSettings(guildId);

        if (!newPrefix) {
            const embed = new EmbedBuilder()
                .setColor(0x00ae86)
                .setTitle('⚙️ Server Prefix')
                .setDescription(`The current prefix for this server is: \`${currentSettings.prefix}\``)
                .setFooter({ text: 'Use /prefix [new_prefix] to change it' });

            return context.reply({ embeds: [embed] });
        }

        // Check permissions for prefix change if it's a message command
        if (!context.isInteraction && !context.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return context.reply('❌ You need the **Manage Server** permission to change the prefix.');
        }

        // Update the prefix
        await updateGuildSettings(guildId, { prefix: newPrefix });

        const successEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Prefix Updated')
            .setDescription(`The command prefix for **${(context.interaction?.guild || context.message?.guild)?.name}** has been set to: \`${newPrefix}\``)
            .setFooter({ text: 'The bot will now respond to this prefix!' });

        await context.reply({ embeds: [successEmbed] });
    }
};
