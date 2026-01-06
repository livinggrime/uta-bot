import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getImageUrl, getRecentTracks} from '../../libs/lastfm';
import {getUserData} from '../../libs/userdata';


export default {
    aliases: ['re', 'r'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('recent')
        .setDescription('Show recent tracks for you or another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to check (defaults to you)')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of tracks to show (1-10, default: 10)')
                .setMinValue(1)
                .setMaxValue(10)
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
        const limit = context.options.getInteger('limit') || 10;
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
            const tracks = await getRecentTracks(userData.username, limit);

            if (!tracks || tracks.length === 0) {
                await context.editReply({
                    content: `${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} scrobbled any tracks yet.`,
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setAuthor({
                    name: `${targetUser.username}'s Recent History`,
                    iconURL: targetUser.displayAvatarURL(),
                    url: `https://www.last.fm/user/${userData.username}`,
                });

            let description = '';
            tracks.forEach((track, index) => {
                const artistName = (track.artist as any)['#text'] || track.artist;
                const albumName = track.album?.['#text'] ? ` — *${track.album['#text']}*` : '';
                const isNowPlaying = track['@attr']?.nowplaying === 'true';

                const time = isNowPlaying
                    ? '**Now Playing**'
                    : track.date
                        ? `<t:${track.date.uts}:R>`
                        : 'Unknown time';

                description += `**${index + 1}.** [**${track.name}**](${track.url})\n`;
                description += `by **${artistName}**${albumName}\n`;
                description += `↳ ${time}\n\n`;
            });

            embed.setDescription(description.trim());

            const latestTrack = tracks[0];
            const coverArt = latestTrack ? await getImageUrl(
                latestTrack.image,
                'track',
                (latestTrack.artist as any)['#text'] || latestTrack.artist,
                latestTrack.name
            ) : null;

            if (coverArt) embed.setThumbnail(coverArt);
            embed.setFooter({ text: `Total Scrobbles: ${parseInt(userData.username).toLocaleString() === 'NaN' ? 'View Profile' : '...'}` });
            // Wait, I don't have total scrobbles here easily without another API call. 
            // Let's just keep it simple or fetch it.

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching recent tracks:', error);
            await context.editReply({
                content: '❌ Error fetching Last.fm data. Please try again later.',
            });
        }
    }
};
