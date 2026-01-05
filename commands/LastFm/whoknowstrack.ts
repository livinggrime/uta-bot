import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getTrackInfo, getNowPlaying, getImageUrl } from '../../libs/lastfm';
import { loadUsers } from '../../libs/userdata';

export default {
    aliases: ['wkt', 'trackplays', 'tp'],
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('whoknowstrack')
        .setDescription('See who knows a track in this server')
        .addStringOption(option =>
            option.setName('artist')
                .setDescription('The artist name')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('track')
                .setDescription('The track name')
                .setRequired(false)
        ),
    async execute(context: any) {
        let artistName = context.options.getString('artist');
        let trackName = context.options.getString('track');
        const guildId = context.guildId;

        if (!guildId) {
            return context.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        await context.deferReply();

        try {
            const allUsers = await loadUsers();

            // If no track/artist provided, try to get from user's now playing
            if (!trackName || !artistName) {
                const userData = allUsers[context.user.id];
                if (userData) {
                    const np = await getNowPlaying(userData.username);
                    if (np) {
                        artistName = typeof np.artist === 'string' ? np.artist : np.artist['#text'];
                        trackName = np.name;
                    }
                }
            }

            if (!artistName || !trackName) {
                return context.editReply({
                    content: '❌ Please provide artist and track names, or be currently playing something.'
                });
            }

            const guild = context.interaction?.guild || context.message?.guild;
            if (!guild) return context.editReply('❌ Could not find server info.');

            const guildMembers = await guild.members.fetch();
            const linkedMembers = Object.entries(allUsers).filter(([discordId]) =>
                guildMembers.has(discordId)
            );

            if (linkedMembers.length === 0) {
                return context.editReply({
                    content: '❌ No one in this server has linked their Last.fm account yet.'
                });
            }

            const results: { username: string; discordTag: string; playcount: number }[] = [];
            let displayArtistName = artistName;
            let displayTrackName = trackName;
            let trackUrl = '';
            let trackImage = '';

            const promises = linkedMembers.map(async ([discordId, userData]) => {
                try {
                    const info = await getTrackInfo(artistName!, trackName!, userData.username);
                    if (info && info.userplaycount) {
                        const count = parseInt(info.userplaycount);
                        if (count > 0) {
                            const member = guildMembers.get(discordId);
                            results.push({
                                username: userData.username,
                                discordTag: member ? member.user.username : 'Unknown',
                                playcount: count
                            });
                        }

                        if (info.artist?.name) displayArtistName = info.artist.name;
                        if (info.name) displayTrackName = info.name;
                        if (info.url) trackUrl = info.url;
                        if (info.album?.image) trackImage = getImageUrl(info.album.image) || '';
                    }
                } catch (e) { }
            });

            await Promise.all(promises);

            if (results.length === 0) {
                return context.editReply({
                    content: `❌ No one in this server has scrobbled **${displayTrackName}** by **${displayArtistName}** yet.`
                });
            }

            results.sort((a, b) => b.playcount - a.playcount);

            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setTitle(`Who knows ${displayTrackName} by ${displayArtistName} in ${guild.name}?`)
                .setURL(trackUrl || null)
                .setThumbnail(trackImage || null);

            let description = '';
            results.slice(0, 15).forEach((res, index) => {
                const medal = index === 0 ? '👑 ' : `${index + 1}. `;
                description += `${medal}**${res.discordTag}** (${res.username}) — **${res.playcount}** scrobbles\n`;
            });

            if (results.length > 15) {
                description += `\n*...and ${results.length - 15} more*`;
            }

            embed.setDescription(description.trim());
            embed.setFooter({ text: `Total: ${results.length} listeners` });

            await context.editReply({ embeds: [embed] });

        } catch (error: any) {
            console.error('Error in whoknowstrack command:', error);
            await context.editReply({
                content: '❌ Error fetching data. Please try again later.'
            });
        }
    }
};
