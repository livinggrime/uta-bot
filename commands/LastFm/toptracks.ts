import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getTopTracks, getImageUrl } from '../../libs/lastfm';
import { getUserData } from '../../libs/userdata';


const PERIOD_LABELS: Record<string, string> = {
    '7day': 'Last 7 Days',
    '1month': 'Last Month',
    '3month': 'Last 3 Months',
    '6month': 'Last 6 Months',
    '12month': 'Last Year',
    'overall': 'All Time',
};

export default {
    aliases: ['tt', 'toptr'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('toptracks')
        .setDescription('Show top tracks for you or another user')
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Time period')
                .setRequired(false)
                .addChoices(
                    { name: 'Last 7 Days', value: '7day' },
                    { name: 'Last Month', value: '1month' },
                    { name: 'Last 3 Months', value: '3month' },
                    { name: 'Last 6 Months', value: '6month' },
                    { name: 'Last Year', value: '12month' },
                    { name: 'All Time', value: 'overall' }
                )
        )
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
        ),
    async execute(context: any) {
        const targetUser = context.options.getUser('user') || context.user;
        const period = context.options.getString('period') || 'overall';
        const limit = context.options.getInteger('limit') || 10;
        const userData = getUserData(targetUser.id);

        if (!userData) {
            await context.reply({
                content: `❌ ${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} linked a Last.fm account yet. Use \`/setfm\` to link one.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await context.deferReply();

        try {
            const tracks = await getTopTracks(userData.username, period, limit);

            if (!tracks || tracks.length === 0) {
                await context.editReply({
                    content: `No top tracks found for ${targetUser.id === context.user.id ? 'you' : targetUser.username} in this time period.`,
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x1db954)
                .setAuthor({
                    name: `${targetUser.username}'s Top Tracks • ${PERIOD_LABELS[period]}`,
                    iconURL: targetUser.displayAvatarURL(),
                    url: `https://www.last.fm/user/${userData.username}`,
                });

            let description = '';
            tracks.forEach((track, index) => {
                const artistName = (track.artist as any)['#text'] || track.artist;
                const plays = parseInt(track.playcount || '0').toLocaleString();
                description += `**${index + 1}.** [${track.name}](${track.url})\n`;
                description += `   *${artistName}* • ${plays} plays\n\n`;
            });

            embed.setDescription(description.trim());

            if (tracks.length > 0 && tracks[0]) {
                const firstTrackImage = getImageUrl(tracks[0].image);
                if (firstTrackImage) {
                    embed.setThumbnail(firstTrackImage);
                }
            }

            embed.setFooter({ text: `Last.fm • ${userData.username}` });

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching top tracks:', error);
            await context.editReply({
                content: '❌ Error fetching Last.fm data. Please try again later.',
            });
        }
    }
};
