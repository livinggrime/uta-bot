import {
    ApplicationIntegrationType,
    AttachmentBuilder,
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from 'discord.js';
import {getImageUrl, getTopAlbums, getTopArtists, getTopTracks} from '../../libs/lastfm';
import {getUserData} from '../../libs/userdata';
import {type ChartItem, generateChart} from '../../libs/charts';

export default {
    aliases: ['c', 'chart'],
    cooldown: 15,
    data: new SlashCommandBuilder()
        .setName('chart')
        .setDescription('Generate a chart of your top artists, albums, or tracks')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of chart to generate')
                .addChoices(
                    { name: 'Artists', value: 'artist' },
                    { name: 'Albums', value: 'album' },
                    { name: 'Tracks', value: 'track' }
                )
        )
        .addStringOption(option =>
            option.setName('period')
                .setDescription('The time period')
                .addChoices(
                    { name: 'Week', value: '7day' },
                    { name: 'Month', value: '1month' },
                    { name: '3 Months', value: '3month' },
                    { name: '6 Months', value: '6month' },
                    { name: 'Year', value: '12month' },
                    { name: 'Overall', value: 'overall' }
                )
        )
        .addIntegerOption(option =>
            option.setName('size')
                .setDescription('The dimension of the grid (e.g., 3 for 3x3). Min 2, Max 16.')
                .setMinValue(2)
                .setMaxValue(16)
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to generate the chart for')
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
        const type = context.options.getString('type') || 'artist';
        const period = context.options.getString('period') || '7day';
        const dim = context.options.getInteger('size') || 3;
        const targetUser = context.options.getUser('user') || context.user;

        await context.deferReply();

        try {
            const userData = await getUserData(targetUser.id);
            if (!userData) {
                return context.editReply({
                    content: `❌ ${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} linked a Last.fm account yet. Use \`/link\` to connect.`
                });
            }

            const username = userData.username;
            const limit = dim * dim;
            let items: ChartItem[] = [];

            if (type === 'artist') {
                const artists = await getTopArtists(username, period, limit);
                items = await Promise.all(artists.map(async a => ({
                    name: a.name,
                    playcount: a.playcount,
                    imageUrl: await getImageUrl(a.image, 'artist', a.name)
                })));
            } else if (type === 'album') {
                const albums = await getTopAlbums(username, period, limit);
                items = await Promise.all(albums.map(async a => ({
                    name: a.name,
                    secondary: a.artist.name,
                    playcount: a.playcount,
                    imageUrl: await getImageUrl(a.image, 'album', a.artist.name, a.name)
                })));
            } else if (type === 'track') {
                const tracks = await getTopTracks(username, period, limit);
                items = await Promise.all(tracks.map(async t => ({
                    name: t.name,
                    secondary: typeof t.artist === "string" ? t.artist : t.artist['#text'],
                    playcount: t.playcount || '0',
                    imageUrl: await getImageUrl(
                        t.image,
                        'track',
                        typeof t.artist === 'string' ? t.artist : t.artist["#text"],
                        t.name
                    )
                })));
            }

            if (items.length === 0) {
                return context.editReply({
                    content: `❌ No data found for the selected period.`
                });
            }

            // Fill with placeholders if less than limit
            while (items.length < limit) {
                items.push({ name: '', playcount: '0', imageUrl: null });
            }

            const chartBuffer = await generateChart(items, dim);
            const attachment = new AttachmentBuilder(chartBuffer, { name: 'chart.png' });

            const periodDisplay: Record<string, string> = {
                '7day': 'Last Week',
                '1month': 'Last Month',
                '3month': 'Last 3 Months',
                '6month': 'Last 6 Months',
                '12month': 'Last Year',
                'overall': 'Overall'
            };

            const periodName = periodDisplay[period] || period;

            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setTitle(`${targetUser.username}'s Top ${type.charAt(0).toUpperCase() + type.slice(1)}s`)
                .setDescription(`Showing ${dim}x${dim} grid for **${periodName}**`)
                .setImage('attachment://chart.png')
                .setFooter({ text: `Last.fm: ${username}` });

            await context.editReply({
                embeds: [embed],
                files: [attachment]
            });

        } catch (error: any) {
            console.error('Error in chart command:', error);
            await context.editReply({
                content: '❌ Error generating chart. Please try again later.'
            });
        }
    }
};
