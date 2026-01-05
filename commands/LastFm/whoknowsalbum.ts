import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getAlbumInfo, getNowPlaying, getImageUrl } from '../../libs/lastfm';
import { loadUsers } from '../../libs/userdata';

export default {
    aliases: ['wka', 'albumplays'],
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('whoknowsalbum')
        .setDescription('See who knows an album in this server')
        .addStringOption(option =>
            option.setName('artist')
                .setDescription('The artist name')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('album')
                .setDescription('The album name')
                .setRequired(false)
        ),
    async execute(context: any) {
        let artistName = context.options.getString('artist');
        let albumName = context.options.getString('album');
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

            // If no album/artist provided, try to get from user's now playing
            if (!albumName || !artistName) {
                const userData = allUsers[context.user.id];
                if (userData) {
                    const np = await getNowPlaying(userData.username);
                    if (np && np.album?.['#text']) {
                        artistName = typeof np.artist === 'string' ? np.artist : np.artist['#text'];
                        albumName = np.album['#text'];
                    }
                }
            }

            if (!artistName || !albumName) {
                return context.editReply({
                    content: '❌ Please provide artist and album names, or be currently playing an album.'
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
            let displayAlbumName = albumName;
            let albumUrl = '';
            let albumImage = '';

            const promises = linkedMembers.map(async ([discordId, userData]) => {
                try {
                    const info = await getAlbumInfo(artistName!, albumName!, userData.username);
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

                        if (info.artist) displayArtistName = info.artist;
                        if (info.name) displayAlbumName = info.name;
                        if (info.url) albumUrl = info.url;
                        if (info.image) albumImage = getImageUrl(info.image) || '';
                    }
                } catch (e) { }
            });

            await Promise.all(promises);

            if (results.length === 0) {
                return context.editReply({
                    content: `❌ No one in this server has scrobbled **${displayAlbumName}** by **${displayArtistName}** yet.`
                });
            }

            results.sort((a, b) => b.playcount - a.playcount);

            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setTitle(`Who knows ${displayAlbumName} by ${displayArtistName} in ${guild.name}?`)
                .setURL(albumUrl || null)
                .setThumbnail(albumImage || null);

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
            console.error('Error in whoknowsalbum command:', error);
            await context.editReply({
                content: '❌ Error fetching data. Please try again later.'
            });
        }
    }
};
