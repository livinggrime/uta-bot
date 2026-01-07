import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getImageUrl, getNowPlaying} from '../../libs/lastfm';
import {getUserData} from '../../libs/userdata';

export default {
    aliases: ['np', 'now', 'fm'],
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show what you or another user is currently listening to')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to check (defaults to you)')
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
        const targetUser = context.options.getUser('user') || context.user;
        const userData = await getUserData(targetUser.id);

        if (!userData) {
            await context.reply({
                content: `❌ ${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} linked a Last.fm account yet. Use \`/setfm\` to link one.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await context.deferReply();

        try {
            const track = await getNowPlaying(userData.username);

            if (!track) {
                await context.editReply({
                    content: `${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} scrobbled any tracks yet.`,
                });
                return;
            }

            const isNowPlaying = track['@attr']?.nowplaying === 'true';
            const artistName = String(track.artist["#text"] || track.artist);
            const albumName = String(track.album?.["#text"] || 'Unknown Album');
            const imageUrl = await getImageUrl(track.image);

            const embed = new EmbedBuilder()
                .setColor(isNowPlaying ? 0x00ff00 : 0x808080)
                .setAuthor({
                    name: `${targetUser.username}'s ${isNowPlaying ? 'Now Playing' : 'Last Played'}`,
                    iconURL: targetUser.displayAvatarURL(),
                })
                .setTitle(track.name)
                .setURL(track.url || `https://www.last.fm/user/${userData.username}`)
                .addFields(
                    { name: 'Artist', value: artistName, inline: true },
                    { name: 'Album', value: albumName, inline: true }
                );

            if (track.playcount) {
                embed.addFields({ name: '▶️ Plays', value: track.playcount, inline: true });
            }

            if (imageUrl) {
                embed.setThumbnail(imageUrl);
            }

            if (!isNowPlaying && track.date) {
                embed.setFooter({ text: `Last played` });
                embed.setTimestamp(parseInt(track.date.uts) * 1000);
            }

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching now playing:', error);
            await context.editReply({
                content: 'Error fetching Last.fm data. Please try again later.',
            });
        }
    }
};
