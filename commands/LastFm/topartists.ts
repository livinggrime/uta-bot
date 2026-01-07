import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getTopArtists} from '../../libs/lastfm';
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
    aliases: ['ta', 'topart'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('topartists')
        .setDescription('Show top artists for you or another user')
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
                .setDescription('Number of artists to show (1-50, default: 10)')
                .setMinValue(1)
                .setMaxValue(50)
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
            const artists = await getTopArtists(userData.username, period, limit);

            if (!artists || artists.length === 0) {
                await context.editReply({
                    content: `No top artists found for ${targetUser.id === context.user.id ? 'you' : targetUser.username} in this time period.`,
                });
                return;
            }

            const embeds: EmbedBuilder[] = [];
            const chunkSize = 10;
            for (let i = 0; i < artists.length; i += chunkSize) {
                const chunk = artists.slice(i, i + chunkSize);
                const embed = new EmbedBuilder()
                    .setColor(0xd51007)
                    .setAuthor({
                        name: `${targetUser.username}'s Top Artists • ${PERIOD_LABELS[period]}`,
                        iconURL: targetUser.displayAvatarURL(),
                        url: `https://www.last.fm/user/${userData.username}`,
                    });

                let description = '';
                chunk.forEach((artist, index) => {
                    const globalIndex = i + index;
                    const plays = parseInt(artist.playcount).toLocaleString();
                    description += `**${globalIndex + 1}.** [${artist.name}](${artist.url}) \`-\``;
                    description += `   ${plays} plays\n\n`;
                });

                embed.setDescription(description.trim());

                embed.setFooter({text: `Last.fm • ${userData.username}`});
                embeds.push(embed);
            }

            await paginate(context, embeds);
        } catch (error: any) {
            console.error('Error fetching top artists:', error);
            await context.editReply({
                content: '❌ Error fetching Last.fm data. Please try again later.',
            });
        }
    }
};
