import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getArtistInfo, getImageUrl, getNowPlaying, getUserInfo} from '../../libs/lastfm';
import {loadUsers, loadUsersByIds} from '../../libs/userdata';
import {paginate} from '../../libs/pagination';

export default {
    aliases: ['wk', 'w', 'artistplays', 'ap'],
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('whoknows')
        .setDescription('See who knows an artist in this server')
        .addStringOption(option =>
            option.setName('artist')
                .setDescription('The artist to check (defaults to your now playing)')
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
        const guildId = context.guildId;

        if (!guildId) {
            return context.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        await context.deferReply();

        try {
            const guild = context.interaction?.guild || context.message?.guild;
            if (!guild) return context.editReply('❌ Could not find server info.');

            const guildMembers = await guild.members.fetch();
            const memberIds: string[] = Array.from(guildMembers.keys());
            
            // Only load users who are actually in this guild
            const guildUsers = await loadUsersByIds(memberIds);

            // If no artist provided, try to get from user's now playing
            if (!artistName) {
                const userData = guildUsers[context.user.id];
                if (userData) {
                    const np = await getNowPlaying(userData.username);
                    if (np) {
                        artistName = np.artist['#text'];
                    }
                }
            }

            if (!artistName) {
                return context.editReply({
                    content: '❌ Please provide an artist name or be currently playing something.'
                });
            }

            const linkedMembers = Object.entries(guildUsers).filter(([discordId]) =>
                guildMembers.has(discordId)
            );

            if (linkedMembers.length === 0) {
                return context.editReply({
                    content: '❌ No one in this server has linked their Last.fm account yet.'
                });
            }

            let displayArtistName = artistName;
            let artistUrl = '';
            let artistImage = '';

            // Batch fetch artist info for all users
            const artistPromises = linkedMembers.map(async ([discordId, userData]) => {
                try {
                    const artistInfo = await getArtistInfo(artistName!, userData.username);
                    if (artistInfo && artistInfo.stats && artistInfo.stats.userplaycount) {
                        const count = parseInt(artistInfo.stats.userplaycount);
                        if (count > 0) {
                            return {
                                discordId,
                                playcount: count,
                                username: userData.username,
                                artistInfo
                            };
                        }
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            });

            const artistResults = await Promise.all(artistPromises);
            const validUsers = artistResults.filter(result => result !== null);

            if (validUsers.length === 0) {
                return context.editReply({
                    content: `❌ No one in this server has scrobbled **${artistName}** yet.`
                });
            }

            // Pick up global info from the first successful request
            const firstValid = validUsers[0]!;
            if (firstValid.artistInfo.name) displayArtistName = firstValid.artistInfo.name;
            if (firstValid.artistInfo.url) artistUrl = firstValid.artistInfo.url;

            // Batch fetch user info only for users who have playcounts
            const userPromises = validUsers.map(async (user) => {
                try {
                    const userInfo = await getUserInfo(user!.username);
                    const member = guildMembers.get(user!.discordId);
                    return {
                        userurl: userInfo.url,
                        discordName: member ? member.user.globalName || member.user.username : "Unknown",
                        discordTag: member ? member.user.username : 'Unknown',
                        playcount: user!.playcount
                    };
                } catch (e) {
                    return null;
                }
            });

            const userResults = await Promise.all(userPromises);
            const results = userResults.filter(result => result !== null);

            // Get artist image if available
            if (firstValid.artistInfo.image) {
                artistImage = await getImageUrl(firstValid.artistInfo.image, 'artist', firstValid.artistInfo.name) || '';
            }

            // Sort by playcount descending
            results.sort((a, b) => b.playcount - a.playcount);

	        const embeds: EmbedBuilder[] = [];
	        const chunkSize = 10;
	        for (let i = 0; i < results.length; i += chunkSize) {
		        const chunk = results.slice(i, i + chunkSize);
		        const embed = new EmbedBuilder()
			        .setColor(0xd51007)
			        .setTitle(`${displayArtistName} in ${guild.name}?`)
			        .setURL(artistUrl || null)
			        .setThumbnail(artistImage || null);

		        let description = '';
		        chunk.forEach((res, index) => {
			        const globalIndex = i + index;
			        const medal = globalIndex === 0 ? '1. ' : `${globalIndex + 1}. `;
			        description += `${medal}**[${res.discordName}](${res.userurl})**  — **${res.playcount}** scrobbles\n`;
		        });

		        embed.setDescription(description.trim());
		        embed.setFooter({text: `Total: ${results.length} listeners`});
		        embeds.push(embed);
	        }

	        await paginate(context, embeds);

        } catch (error: any) {
            console.error('Error in whoknows command:', error);
            await context.editReply({
                content: '❌ Error fetching data. Please try again later.'
            });
        }
    }
};