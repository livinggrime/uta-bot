import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getAlbumInfo, getImageUrl, getNowPlaying, getUserInfo} from '../../libs/lastfm';
import {loadUsers} from '../../libs/userdata';
import {paginate} from '../../libs/pagination';

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
                        artistName = np.artist['#text'];
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

            const results: {
                discordName: string;
                userurl: string; discordTag: string; playcount: number }[] = [];
            let displayArtistName = artistName;
            let displayAlbumName = albumName;
            let albumUrl = '';
            let albumImage = '';

            const promises = linkedMembers.map(async ([discordId, userData]) => {
                try {
                    const info = await getAlbumInfo(artistName!, albumName!, userData.username);
                    const userInfo = await getUserInfo(userData.username!);
                    if (info && info.userplaycount) {
                        const count = parseInt(info.userplaycount);
                        if (count > 0) {
                            const member = guildMembers.get(discordId);
                            results.push({
                                userurl: userInfo.url,
                                discordTag: member ? member.user.username : 'Unknown',
                                playcount: count,
                                discordName: member ? member.globalName : 'Unknown'
                            });
                        }

                        if (info.artist) displayArtistName = info.artist;
                        if (info.name) displayAlbumName = info.name;
                        if (info.url) albumUrl = info.url;
                        if (info.image) albumImage = await getImageUrl(info.image, 'album', info.artist, info.name) || '';
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

	        const embeds: EmbedBuilder[] = [];
	        const chunkSize = 10;
	        for (let i = 0; i < results.length; i += chunkSize) {
		        const chunk = results.slice(i, i + chunkSize);
		        const embed = new EmbedBuilder()
			        .setColor(0xd51007)
			        .setTitle(`${displayAlbumName} by ${displayArtistName} in ${guild.name}?`)
			        .setURL(albumUrl || null)
			        .setThumbnail(albumImage || null);

		        let description = '';
		        chunk.forEach((res, index) => {
			        const globalIndex = i + index;
			        const medal = globalIndex === 0 ? '1.' : `${globalIndex + 1}. `;
			        description += `${medal}**[${res.discordName}](${res.userurl})** — **${res.playcount}** scrobbles\n`;
		        });

		        embed.setDescription(description.trim());
		        embed.setFooter({text: `Total: ${results.length} listeners`});
		        embeds.push(embed);
	        }

	        await paginate(context, embeds);

        } catch (error: any) {
            console.error('Error in whoknowsalbum command:', error);
            await context.editReply({
                content: '❌ Error fetching data. Please try again later.'
            });
        }
    }
};
