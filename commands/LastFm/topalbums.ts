import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getTopAlbums, getImageUrl } from '../../libs/lastfm';
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
    aliases: ['tal', 'topalb'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('topalbums')
        .setDescription('Show top albums for you or another user')
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
                .setDescription('Number of albums to show (1-10, default: 10)')
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
            const albums = await getTopAlbums(userData.username, period, limit);

            if (!albums || albums.length === 0) {
                await context.editReply({
                    content: `No top albums found for ${targetUser.id === context.user.id ? 'you' : targetUser.username} in this time period.`,
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xff6b35)
                .setAuthor({
                    name: `${targetUser.username}'s Top Albums • ${PERIOD_LABELS[period]}`,
                    iconURL: targetUser.displayAvatarURL(),
                    url: `https://www.last.fm/user/${userData.username}`,
                });

            let description = '';
            albums.forEach((album, index) => {
                const artistName = album.artist.name;
                const plays = parseInt(album.playcount).toLocaleString();
                description += `**${index + 1}.** [${album.name}](${album.url})\n`;
                description += `   *${artistName}* • ${plays} plays\n\n`;
            });

            embed.setDescription(description.trim());

            if (albums.length > 0 && albums[0]) {
                const firstAlbumImage = getImageUrl(albums[0].image);
                if (firstAlbumImage) {
                    embed.setThumbnail(firstAlbumImage);
                }
            }

            embed.setFooter({ text: `Last.fm • ${userData.username}` });

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching top albums:', error);
            await context.editReply({
                content: '❌ Error fetching Last.fm data. Please try again later.',
            });
        }
    }
};
