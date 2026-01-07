import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getUserInfo, getImageUrl} from '../../libs/lastfm';
import {getUserData} from '../../libs/userdata';

export default {
    cooldown: 5,
    aliases: ['pc'],
    data: new SlashCommandBuilder()
        .setName('pace')
        .setDescription('Show your scrobble rate and milestone estimates')
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
        await context.deferReply();

        try {
            const userData = await getUserData(context.user.id);
            if (!userData) {
                return context.editReply({
                    content: '❌ Please link your Last.fm account first using `/link`.'
                });
            }

            const userInfo = await getUserInfo(userData.username);
            
            // Calculate scrobble statistics
            const totalScrobbles = parseInt(userInfo.playcount);
            const registrationDate = new Date(Number(userInfo.registered.unixtime) * 1000);
            const currentDate = new Date();
            const daysSinceRegistration = (currentDate.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24);
            
            // Scrobble rate calculations
            const scrobblesPerDay = totalScrobbles / daysSinceRegistration;
            const scrobblesPerWeek = scrobblesPerDay * 7;
            const scrobblesPerMonth = scrobblesPerDay * 30.44; // Average month length
            const scrobblesPerYear = scrobblesPerDay * 365.25;

            // Milestone estimates
            const milestones = [
                { number: 1000, name: '1,000', emoji: '🎯' },
                { number: 5000, name: '5,000', emoji: '🌟' },
                { number: 10000, name: '10,000', emoji: '⭐' },
                { number: 25000, name: '25,000', emoji: '💫' },
                { number: 50000, name: '50,000', emoji: '✨' },
                { number: 75000, name: '75,000', emoji: '🌠' },
                { number: 100000, name: '100,000', emoji: '🌌' },
                { number: 250000, name: '250,000', emoji: '🎆' },
                { number: 500000, name: '500,000', emoji: '🎇' },
                { number: 1000000, name: '1,000,000', emoji: '🏆' }
            ];

            // Find next milestones
            const upcomingMilestones = milestones
                .filter(m => m.number > totalScrobbles)
                .slice(0, 3);

            const imageUrl = userInfo.image ? await getImageUrl(userInfo.image) : null;
            
            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setTitle(`📊 ${userInfo.name}'s Scrobble Pace`)
                .setURL(userInfo.url)
                .setThumbnail(imageUrl)
                .addFields(
                    { 
                        name: '📈 Scrobble Rate', 
                        value: `**Daily:** ${scrobblesPerDay.toFixed(1)}\n**Weekly:** ${scrobblesPerWeek.toFixed(0)}\n**Monthly:** ${scrobblesPerMonth.toFixed(0)}\n**Yearly:** ${scrobblesPerYear.toFixed(0)}`,
                        inline: true 
                    },
                    { 
                        name: '📊 Statistics', 
                        value: `**Total:** ${totalScrobbles.toLocaleString()}\n**Days Active:** ${daysSinceRegistration.toFixed(0)}\n**Average:** ${scrobblesPerDay.toFixed(2)}/day`,
                        inline: true 
                    }
                );

            // Add upcoming milestones if any
            if (upcomingMilestones.length > 0) {
                let milestoneText = '';
                for (const milestone of upcomingMilestones) {
                    const remaining = milestone.number - totalScrobbles;
                    const daysToMilestone = remaining / scrobblesPerDay;
                    const targetDate = new Date(currentDate.getTime() + (daysToMilestone * 24 * 60 * 60 * 1000));
                    
                    const formattedDate = targetDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                    
                    milestoneText += `${milestone.emoji} **${milestone.name}**: ${remaining.toLocaleString()} more → ${formattedDate}\n`;
                }
                
                embed.addFields({
                    name: '🎯 Upcoming Milestones',
                    value: milestoneText.trim()
                });
            }

            // Add registered date
            embed.setFooter({
                text: `📅 Member since ${registrationDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                })}`
            });

            await context.editReply({ embeds: [embed] });

        } catch (error: any) {
            console.error('Error in pace command:', error);
            await context.editReply({
                content: '❌ Error fetching scrobble data. Please try again later.'
            });
        }
    }
};