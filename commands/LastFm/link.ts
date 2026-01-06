import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getAuthorizationUrl, getAuthToken, pollForSession} from '../../libs/oauth';
import {registerPendingAuth} from '../../oauth-server';
import {countAltsByFmUsername, saveUser} from '../../libs/userdata';


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
        )
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
                .setDescription('1. Click **Authorize on Last.fm** below.\n2. Click "Allow Access" on the website.\n3. You should be redirected automatically.\n\n**If it doesn\'t redirect:**\nClick the **Confirm Connection** button below after you have allowed access.')
                .addFields(
                    { name: '⏱️ Expires In', value: '5 minutes', inline: true },
                    { name: '🔒 Permissions', value: 'Read & Write', inline: true }
                )
                .setFooter({ text: 'You will be redirected to Last.fm to authorize' });

            const authBtn = new ButtonBuilder()
                .setLabel('Authorize on Last.fm')
                .setStyle(ButtonStyle.Link)
                .setURL(authUrl);

            const confirmBtn = new ButtonBuilder()
                .setCustomId(`confirm_${token}`)
                .setLabel('Confirm Connection')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(authBtn, confirmBtn);

            const response = await context.editReply({
                embeds: [embed],
                components: [row],
            });

            // Create a collector for the confirm button
            const collector = response.createMessageComponentCollector({
                filter: (i: any) => i.customId === `confirm_${token}` && i.user.id === context.user.id,
                time: 5 * 60 * 1000,
            });



            // Start polling in the background (fmbot style)
            const pollPromise = pollForSession(token);

            /**
             * Helper to handle the successful retrieval of a session (fmbot style)
             */
            const processAuth = async (sessionData: { sessionKey: string; username: string }, source: string) => {
                const MAX_OTHER_ACCOUNTS = 2; // Allow up to 2 other Discord accounts (Total 3)
                const otherAccounts = await countAltsByFmUsername(sessionData.username, context.user.id);

                if (otherAccounts > MAX_OTHER_ACCOUNTS) {
                    const altEmbed = new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle('⚠️ Too Many Accounts')
                        .setDescription(`The Last.fm account **${sessionData.username}** is already linked to ${otherAccounts} other Discord accounts.\n\nTo prevent abuse, you cannot link more than ${MAX_OTHER_ACCOUNTS + 1} accounts to a single Last.fm user.`)
                        .setFooter({ text: 'Account Limit Reached' });

                    try {
                        await context.followUp({
                            embeds: [altEmbed],
                            flags: MessageFlags.Ephemeral,
                        });
                    } catch (followErr) {
                        console.error('Error sending follow-up for too many accounts:', followErr);
                        try {
                            await context.editReply({
                                embeds: [altEmbed],
                                components: [],
                            });
                        } catch (editErr) {
                            console.error('Error editing reply for too many accounts:', editErr);
                        }
                    }
                    return false;
                }

                await saveUser(context.user.id, {
                    username: sessionData.username,
                    sessionKey: sessionData.sessionKey,
                    authorizedAt: new Date().toISOString(),
                });

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Authorization Successful!')
                    .setDescription(`Your Last.fm account has been linked! You can now use all commands, including scrobbling.\n\n*${source === 'poll' ? 'Detected automatically' : source === 'manual' ? 'Manually confirmed' : 'Verified via redirect'}*`)
                    .setFooter({ text: 'Last.fm Connection' });

                try {
                    await context.followUp({
                        embeds: [successEmbed],
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (followErr) {
                    console.error('Error sending follow-up in processAuth:', followErr);
                    // If followUp fails, try to edit the original reply instead
                    try {
                        await context.editReply({
                            embeds: [successEmbed],
                            components: [], // Remove buttons
                        });
                    } catch (editErr) {
                        console.error('Error editing reply in processAuth:', editErr);
                    }
                }

                collector.stop('success');
                return true;
            };

            // Update collector to use the helper
            collector.on('collect', async (i: any) => {
                await i.deferUpdate();
                try {
                    const { getSessionKey } = await import('../../libs/oauth');
                    const sessionData = await getSessionKey(token);
                    await processAuth(sessionData, 'manual');
                } catch (err) {
                    try {
                        await i.followUp({
                            content: '❌ No authorization found yet. Please make sure you clicked "Allow Access" on the Last.fm website first.',
                            flags: MessageFlags.Ephemeral,
                        });
                    } catch (followErr) {
                        console.error('Error sending follow-up from button:', followErr);
                    }
                }
            });

            // Wait for authorization (either from redirect or automatic polling)
            const result = await Promise.race([
                authPromise.then(success => success ? 'redirect' : null),
                pollPromise.then(res => res ? 'poll' : null)
            ]);

            if (result && !collector.ended) {
                if (result === 'poll') {
                    const data = await pollPromise;
                    if (data) await processAuth(data, 'poll');
                } else if (result === 'redirect') {
                    // When redirected, the session is already in DB via oauth-server, 
                    // but we call processAuth to show the message (it will handle the upsert gracefully)
                    try {
                        const { getSessionKey } = await import('../../libs/oauth');
                        const sessionData = await getSessionKey(token);
                        await processAuth(sessionData, 'redirect');
                    } catch (err) {
                        console.error('Error processing redirect auth:', err);
                        // Try to send a simple success message since the auth worked but getting session data failed
                        try {
                            await context.followUp({
                                content: '✅ Authorization successful! Your Last.fm account has been linked.',
                                flags: MessageFlags.Ephemeral,
                            });
                        } catch (followErr) {
                            console.error('Error sending follow-up message:', followErr);
                        }
                    }
                }
            } else if (collector.ended && !result) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Authorization Failed')
                    .setDescription('The authorization timed out or failed. Please try again using `/link`.')
                    .setFooter({ text: 'Authorization expires after 5 minutes' });

                try {
                    await context.followUp({
                        embeds: [failEmbed],
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (followErr) {
                    console.error('Error sending follow-up for timeout:', followErr);
                    try {
                        await context.editReply({
                            embeds: [failEmbed],
                            components: [],
                        });
                    } catch (editErr) {
                        console.error('Error editing reply for timeout:', editErr);
                    }
                }
            }
        } catch (error: any) {

            console.error('Error in link command:', error);
            await context.editReply({
                content: '❌ Error initiating Last.fm authorization. Please try again later.',
            });
        }
    }
};
