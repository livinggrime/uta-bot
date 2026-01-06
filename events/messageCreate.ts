import {ChannelType, Collection, Events, Message} from 'discord.js';
import {getGuildSettings} from '../libs/guilddata';

export default {
    name: Events.MessageCreate,
    async execute(message: Message) {
        if (message.author.bot) return;
        if (message.channel.type === ChannelType.DM) return;

        const settings = await getGuildSettings(message.guildId!);
        const prefix = settings.prefix;

        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        const client = message.client as any;
        const command = client.commands.get(commandName) || client.commands.find((cmd: any) => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        // Cooldown logic (Reusing existing infrastructure)
        const { cooldowns } = client;
        if (!cooldowns.has(command.data.name)) {
            cooldowns.set(command.data.name, new Collection());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.data.name);
        const defaultCooldownDuration = 3;
        const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id)! + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.data.name}\` command.`);
            }
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

        try {
            const { createCommandContext } = await import("../libs/bridge");
            const context = createCommandContext(message, args);
            await command.execute(context);
        } catch (error) {
            console.error(error);
            await message.reply('There was an error trying to execute that command!');
        }
    }
};
