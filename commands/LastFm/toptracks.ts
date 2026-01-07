import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getTopTracks} from '../../libs/lastfm';
import {getUserData} from '../../libs/userdata';
import {paginate} from '../../libs/pagination';


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
                .setDescription('Number of tracks to show (default: 10)')
                .setMinValue(1)
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
        const period = context.options.getString('period') || '7day';
        const limit = context.options.getInteger('limit') || '500';
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
            const tracks = await getTopTracks(userData.username, period, limit);

            if (!tracks || tracks.length === 0) {
                await context.editReply({
                    content: `No top tracks found for ${targetUser.id === context.user.id ? 'you' : targetUser.username} in this time period.`,
                });
                return;
            }

            const embeds: EmbedBuilder[] = [];
            const chunkSize = 10;
            for (let i = 0; i < tracks.length; i += chunkSize) {
                const chunk = tracks.slice(i, i + chunkSize);
                const embed = new EmbedBuilder()
                    .setColor(0x1db954)
                    .setAuthor({
                        name: `${targetUser.globalName}'s Top Tracks • ${PERIOD_LABELS[period]}`,
                        iconURL: targetUser.displayAvatarURL(),
                        url: `https://www.last.fm/user/${userData.username}`,
                    });


                let description = '';
                chunk.forEach((track, index) => {
                    const globalIndex = i + index;
                    const artistName = String(track.artist.name || track.artist);
                    const plays = parseInt(track.playcount || '0').toLocaleString();
                    description += `**${globalIndex + 1}.** [${track.name}](${track.url})--*${artistName}* • ${plays} plays\n`;
                });

                embed.setDescription(description.trim());

                embed.setFooter({text: `Last.fm • ${userData.username}`});
                embeds.push(embed);
            }
            await paginate(context, embeds);
        } catch (error: any) {
            console.error('Error fetching top tracks:', error);
            await context.editReply({
                content: '❌ Error fetching Last.fm data. Please try again later.',
            });
        }
    }
};
