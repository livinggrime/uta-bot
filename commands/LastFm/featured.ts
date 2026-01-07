import {ApplicationIntegrationType, EmbedBuilder, InteractionContextType, SlashCommandBuilder} from 'discord.js';
import {loadUsers, loadUsersByIds} from '../../libs/userdata';
import {getImageUrl, getNowPlaying, getUserInfo} from '../../libs/lastfm';

export default {
    aliases: ['feat'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('featured')
        .setDescription('Show a random user who uses the bot')
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
        await context.deferReply();

        try {
            const allUsers = await loadUsers();
            const userIds = Object.keys(allUsers);

            if (userIds.length === 0) {
                return context.editReply({
                    content: '❌ No users have linked their accounts yet.'
                });
            }

            const randomId = userIds[Math.floor(Math.random() * userIds.length)]!;
            const userData = allUsers[randomId];
            if (!userData) return context.editReply('❌ User data missing for selected user.');

            // Try to get their now playing, fallback to profile info
            let np = await getNowPlaying(userData.username);
            const userInfo = await getUserInfo(userData.username);

            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setTitle(`Featured User: ${userInfo.name}`)
                .setURL(userInfo.url)
                .setThumbnail(await getImageUrl(userInfo.image) || null)
                .addFields(
                    { name: '📊 Total Scrobbles', value: parseInt(userInfo.playcount).toLocaleString(), inline: true },
                    { name: '📅 Member Since', value: `<t:${userInfo.registered.unixtime}:D>`, inline: true }
                );

            if (np) {
                const artist = np.artist.name || 'Unknown Artist';
                embed.addFields({ name: '🎵 Currently Listening To', value: `**${np.name}** by **${artist}**` });
            }

            const discordUser = await context.client.users.fetch(randomId).catch(() => null);
            if (discordUser) {
                embed.setAuthor({ name: discordUser.username, iconURL: discordUser.displayAvatarURL() });
            }

            embed.setFooter({ text: 'Use /link to be featured! • Featured user is chosen randomly' });

            await context.editReply({ embeds: [embed] });

        } catch (error: any) {
            console.error('Error in featured command:', error);
            await context.editReply({
                content: '❌ Error fetching featured user. Please try again later.'
            });
        }
    }
};
