import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getRecentTracks } from '../../libs/lastfm';
import { getUserData } from '../../libs/userdata';


export default {
    aliases: ['re'],
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
        ),
    async execute(context: any) {
        const targetUser = context.options.getUser('user') || context.user;
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
            const tracks = await getRecentTracks(userData.username, limit);

            if (!tracks || tracks.length === 0) {
                await context.editReply({
                    content: `${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} scrobbled any tracks yet.`,
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x1db954)
                .setAuthor({
                    name: `${targetUser.username}'s Recent Tracks`,
                    iconURL: targetUser.displayAvatarURL(),
                    url: `https://www.last.fm/user/${userData.username}`,
                });

            let description = '';
            tracks.forEach((track, index) => {
                const artistName = (track.artist as any)['#text'] || track.artist;
                const isNowPlaying = track['@attr']?.nowplaying === 'true';
                const emoji = isNowPlaying ? '🎵' : '▶️';

                description += `${emoji} **${index + 1}.** ${track.name}\n`;
                description += `   *${artistName}*`;

                if (isNowPlaying) {
                    description += ' • **Now Playing**';
                } else if (track.date) {
                    const timestamp = parseInt(track.date.uts);
                    description += ` • <t:${timestamp}:R>`;
                }

                description += '\n\n';
            });

            embed.setDescription(description.trim());
            embed.setFooter({ text: `Last.fm • ${userData.username}` });

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching recent tracks:', error);
            await context.editReply({
                content: '❌ Error fetching Last.fm data. Please try again later.',
            });
        }
    }
};
