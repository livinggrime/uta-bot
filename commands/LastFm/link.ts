import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getAuthToken, getAuthorizationUrl } from '../../libs/oauth';
import { registerPendingAuth } from '../../oauth-server';


export default {
    aliases: ['login', 'setfm'],
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Last.fm account via OAuth or Username (Read-Only)')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Enter your Last.fm username for Read-Only mode (bypasses authorization)')
                .setRequired(false)
        ),
    async execute(context: any) {
        const manualUsername = context.options.getString('username');

        // Handling Read-Only Mode (Manual Username)
        if (manualUsername) {
            const { saveUser } = await import('../../libs/userdata');
            await saveUser(context.user.id, {
                username: manualUsername,
                sessionKey: '', // No session key for read-only
                authorizedAt: new Date().toISOString(),
            });

            await context.reply({
                content: `✅ Linked to **${manualUsername}** in **Read-Only** mode! You can view stats, but scrobbling is disabled. (Use \`/link\` without arguments for full access)`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await context.deferReply({ ephemeral: true });


        try {
            // Step 1: Get authentication token
            const token = await getAuthToken();

            // Step 2: Generate authorization URL
            const authUrl = getAuthorizationUrl(token);

            // Step 3: Register pending auth
            const authPromise = registerPendingAuth(token, context.user.id);

            // Step 4: Send authorization link to user
            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setTitle('🔐 Last.fm Authorization')
                .setDescription('Click the button below to authorize this bot to access your Last.fm account.\n\n**If the page fails to load after clicking "Allow Access":**\nCopy the `token` from the URL address bar and use `/token token:YOUR_TOKEN` here in Discord.')
                .addFields(
                    { name: '⏱️ Expires In', value: '5 minutes', inline: true },
                    { name: '🔒 Permissions', value: 'Read & Write (Scrobbling)', inline: true }
                )
                .setFooter({ text: 'You will be redirected to Last.fm to authorize' });

            const button = new ButtonBuilder()
                .setLabel('Authorize on Last.fm')
                .setStyle(ButtonStyle.Link)
                .setURL(authUrl);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

            await context.editReply({
                embeds: [embed],
                components: [row],
            });

            // Wait for authorization (with 5 minute timeout)
            const success = await authPromise;

            if (success) {
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Authorization Successful!')
                    .setDescription('Your Last.fm account has been linked. You can now use all Last.fm commands, including scrobbling!')
                    .setFooter({ text: 'You can now close the authorization window' });

                await context.followUp({
                    embeds: [successEmbed],
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Authorization Failed')
                    .setDescription('The authorization timed out or failed. Please try again using `/link`.')
                    .setFooter({ text: 'Authorization expires after 5 minutes' });

                await context.followUp({
                    embeds: [failEmbed],
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error: any) {
            console.error('Error in link command:', error);
            await context.editReply({
                content: '❌ Error initiating Last.fm authorization. Please try again later.',
            });
        }
    }
};
