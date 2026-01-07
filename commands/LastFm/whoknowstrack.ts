import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getImageUrl, getNowPlaying, getTrackInfo} from '../../libs/lastfm';
import {loadUsers} from '../../libs/userdata';
import {paginate} from '../../libs/pagination';

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
                        if (info.album?.image) trackImage = await getImageUrl(info.album.image, 'track', info.artist?.name, info.name) || '';
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

	        const embeds: EmbedBuilder[] = [];
	        const chunkSize = 10;
	        for (let i = 0; i < results.length; i += chunkSize) {
		        const chunk = results.slice(i, i + chunkSize);
		        const embed = new EmbedBuilder()
			        .setColor(0xd51007)
			        .setTitle(`Who knows ${displayTrackName} by ${displayArtistName} in ${guild.name}?`)
			        .setURL(trackUrl || null)
			        .setThumbnail(trackImage || null);

		        let description = '';
		        chunk.forEach((res, index) => {
			        const globalIndex = i + index;
			        const medal = globalIndex === 0 ? '👑 ' : `${globalIndex + 1}. `;
			        description += `${medal}**${res.discordTag}** (${res.username}) — **${res.playcount}** scrobbles\n`;
		        });

		        embed.setDescription(description.trim());
		        embed.setFooter({text: `Total: ${results.length} listeners`});
		        embeds.push(embed);
	        }

	        await paginate(context, embeds);

        } catch (error: any) {
            console.error('Error in whoknowstrack command:', error);
            await context.editReply({
                content: '❌ Error fetching data. Please try again later.'
            });
        }
    }
};
