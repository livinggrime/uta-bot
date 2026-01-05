import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getSessionKey } from '../../libs/oauth';
import { saveUser } from '../../libs/userdata';

export default {
    aliases: ['confirmfm'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('token')
        .setDescription('Manually confirm Last.fm authorization using the token from the URL')
        .addStringOption(option =>
            option.setName('token')
                .setDescription('The token from the Last.fm redirect URL (e.g. ?token=...)')
                .setRequired(true)
        ),
    async execute(context: any) {
        const token = context.options.getString('token');

        if (!token) {
            return context.reply({
                content: '❌ Please provide the token. Example: `!token YOUR_TOKEN`'
            });
        }

        await context.deferReply({ ephemeral: true });

        try {
            // Step 3: Exchange token for session key
            const { sessionKey, username } = await getSessionKey(token);

            // Save the session to MongoDB
            await saveUser(context.user.id, {
                username: username,
                sessionKey: sessionKey,
                authorizedAt: new Date().toISOString(),
            });

            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Manual Authorization Successful!')
                .setDescription(`Your Last.fm account **${username}** has been linked manually. You can now use scrobbling!`)
                .setFooter({ text: 'Last.fm OAuth' });

            await context.editReply({
                embeds: [successEmbed],
            });

        } catch (error: any) {
            console.error('Manual OAuth Error:', error);
            await context.editReply({
                content: '❌ Failed to link account. This token might be expired or already used. Please try `/link` again to get a fresh link.',
            });
        }
    }
};
