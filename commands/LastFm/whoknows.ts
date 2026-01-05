import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getArtistInfo, getNowPlaying, getImageUrl } from '../../libs/lastfm';
import { loadUsers, type UserData } from '../../libs/userdata';

export default {
    aliases: ['wk'],
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('whoknows')
        .setDescription('See who knows an artist in this server')
        .addStringOption(option =>
            option.setName('artist')
                .setDescription('The artist to check (defaults to your now playing)')
                .setRequired(false)
        ),
    async execute(context: any) {
        let artistName = context.options.getString('artist');
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

            // If no artist provided, try to get from user's now playing
            if (!artistName) {
                const userData = allUsers[context.user.id];
                if (userData) {
                    const np = await getNowPlaying(userData.username);
                    if (np) {
                        artistName = typeof np.artist === 'string' ? np.artist : np.artist['#text'];
                    }
                }
            }

            if (!artistName) {
                return context.editReply({
                    content: '❌ Please provide an artist name or be currently playing something.'
                });
            }

            // For guild members, we need to handle interaction vs message
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
            let artistUrl = '';
            let artistImage = '';

            // Fetch playcounts for all linked members in the guild
            const promises = linkedMembers.map(async ([discordId, userData]) => {
                try {
                    const artistInfo = await getArtistInfo(artistName!, userData.username);
                    if (artistInfo && artistInfo.stats && artistInfo.stats.userplaycount) {
                        const count = parseInt(artistInfo.stats.userplaycount);
                        if (count > 0) {
                            const member = guildMembers.get(discordId);
                            results.push({
                                username: userData.username,
                                discordTag: member ? member.user.username : 'Unknown',
                                playcount: count
                            });
                        }

                        // Pick up global info from the first successful request
                        if (artistInfo.name) displayArtistName = artistInfo.name;
                        if (artistInfo.url) artistUrl = artistInfo.url;
                        if (artistInfo.image) artistImage = getImageUrl(artistInfo.image) || '';
                    }
                } catch (e) {
                    // Ignore errors for individual users
                }
            });

            await Promise.all(promises);

            if (results.length === 0) {
                return context.editReply({
                    content: `❌ No one in this server has scrobbled **${artistName}** yet.`
                });
            }

            // Sort by playcount descending
            results.sort((a, b) => b.playcount - a.playcount);

            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setTitle(`Who knows ${displayArtistName} in ${guild.name}?`)
                .setURL(artistUrl || null)
                .setThumbnail(artistImage || null);

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
            console.error('Error in whoknows command:', error);
            await context.editReply({
                content: '❌ Error fetching data. Please try again later.'
            });
        }
    }
};
