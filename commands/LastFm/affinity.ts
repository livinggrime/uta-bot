import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getTopArtists } from '../../libs/lastfm';
import { getUserData } from '../../libs/userdata';

export default {
    aliases: ['conf', 'affinity'],
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('affinity')
        .setDescription('Compare your music taste with another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to compare with')
                .setRequired(true)
        ),
    async execute(context: any) {
        const targetUser = context.options.getUser('user');
        const selfUser = context.user;

        if (targetUser.id === selfUser.id) {
            return context.reply({
                content: '❌ You cannot compare with yourself!',
                flags: MessageFlags.Ephemeral
            });
        }

        await context.deferReply();

        try {
            const selfData = await getUserData(selfUser.id);
            const targetData = await getUserData(targetUser.id);

            if (!selfData) {
                return context.editReply({
                    content: '❌ You haven\'t linked your Last.fm account yet. Use `/link` to connect.'
                });
            }

            if (!targetData) {
                return context.editReply({
                    content: `❌ **${targetUser.username}** hasn't linked their Last.fm account yet.`
                });
            }

            // Fetch top 50 artists for both users
            const [selfArtists, targetArtists] = await Promise.all([
                getTopArtists(selfData.username, 'overall', 50),
                getTopArtists(targetData.username, 'overall', 50)
            ]);

            const selfMap = new Map(selfArtists.map(a => [a.name.toLowerCase(), a]));
            const targetMap = new Map(targetArtists.map(a => [a.name.toLowerCase(), a]));

            const common: string[] = [];
            let score = 0;

            selfMap.forEach((v, k) => {
                if (targetMap.has(k)) {
                    common.push(v.name);
                    // Basic affinity calculation: just count overlap for now
                    score++;
                }
            });

            // Affinity levels (fmbot style)
            let level = 'None';
            let color = 0x808080;

            if (score > 15) { level = 'Super'; color = 0xff00ff; }
            else if (score > 10) { level = 'Very High'; color = 0xff0000; }
            else if (score > 6) { level = 'High'; color = 0xffa500; }
            else if (score > 3) { level = 'Medium'; color = 0xffff00; }
            else if (score > 1) { level = 'Low'; color = 0x00ff00; }

            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: 'Taste Comparison', iconURL: selfUser.displayAvatarURL() })
                .setTitle(`${selfUser.username} vs ${targetUser.username}`)
                .setDescription(`Your music affinity is **${level}** (**${Math.round((score / 50) * 100)}%** overall similarity)`)
                .addFields(
                    { name: 'Common Artists', value: common.length > 0 ? common.slice(0, 10).join(', ') + (common.length > 10 ? ` and ${common.length - 10} more` : '') : 'None' }
                )
                .setFooter({ text: 'Based on top 50 artists' });

            await context.editReply({ embeds: [embed] });

        } catch (error: any) {
            console.error('Error in affinity command:', error);
            await context.editReply({
                content: '❌ Error comparing accounts. Please try again later.'
            });
        }
    }
};
