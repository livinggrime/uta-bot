import { ChatInputCommandInteraction, Message, User, GuildMember, TextChannel, DMChannel, EmbedBuilder } from 'discord.js';

export interface CommandContext {
    user: User;
    member: GuildMember | null;
    channel: TextChannel | DMChannel | any;
    guildId: string | null;
    isInteraction: boolean;
    interaction?: ChatInputCommandInteraction;
    message?: Message;

    // Unified response methods
    reply: (content: any) => Promise<any>;
    deferReply: (options?: { ephemeral?: boolean }) => Promise<any>;
    editReply: (content: any) => Promise<any>;
    followUp: (content: any) => Promise<any>;

    // Option helpers (deprecated in favor of .options)
    getUser: (name: string) => User | null;
    getString: (name: string, index?: number) => string | null;
    getInteger: (name: string, index?: number) => number | null;

    // Proxy for interaction.options
    options: {
        getUser: (name: string) => User | null;
        getString: (name: string) => string | null;
        getInteger: (name: string) => number | null;
        getSubcommand: () => string | null;
    }
}

export function createCommandContext(input: ChatInputCommandInteraction | Message, args: string[] = []): CommandContext {
    const isInteraction = input instanceof ChatInputCommandInteraction;

    const context: CommandContext = {
        user: isInteraction ? input.user : input.author,
        member: input.member as GuildMember,
        channel: input.channel,
        guildId: input.guildId,
        isInteraction,
        interaction: isInteraction ? input : undefined,
        message: !isInteraction ? input : undefined,

        reply: async (content) => {
            if (isInteraction) {
                if (input.replied || input.deferred) return input.followUp(content);
                return input.reply(content);
            }
            return input.reply(content);
        },

        deferReply: async (options) => {
            if (isInteraction) return input.deferReply({ flags: options?.ephemeral ? 64 : undefined });
            // @ts-ignore
            if (input.channel?.sendTyping) await input.channel.sendTyping();
        },

        editReply: async (content) => {
            if (isInteraction) return input.editReply(content);
            // @ts-ignore
            return input.channel.send(content);
        },

        followUp: async (content) => {
            if (isInteraction) return input.followUp(content);
            // @ts-ignore
            return input.channel.send(content);
        },

        getUser: (name) => {
            if (isInteraction) return input.options.getUser(name);

            // For messages, we look for mentions or IDs in args
            // Basic mention parsing: <@!ID> or <@ID>
            const mention = input.mentions.users.first();
            if (mention) return mention;

            // Fallback: look for a user ID string in args
            const possibleId = args.find(arg => /^\d{17,19}$/.test(arg));
            if (possibleId) {
                const user = input.client.users.cache.get(possibleId);
                if (user) return user;
            }

            return null;
        },

        getString: (name, index = 0) => {
            if (isInteraction) return input.options.getString(name);
            return args[index] || null;
        },

        getInteger: (name, index = 0) => {
            if (isInteraction) return input.options.getInteger(name);
            const val = args[index] ? parseInt(args[index]) : NaN;
            return isNaN(val) ? null : val;
        },

        options: {
            getUser: (name: string) => {
                if (isInteraction) return input.options.getUser(name);
                const mention = input.mentions.users.first();
                if (mention) return mention;
                const possibleId = args.find(arg => /^\d{17,19}$/.test(arg));
                if (possibleId) return input.client.users.cache.get(possibleId) || null;
                return null;
            },
            getString: (name: string) => {
                if (isInteraction) return input.options.getString(name);
                // Heuristic: finding the argument by name isn't possible for simple message commands
                // so we just return the next available argument or a specific one if we want to be fancy.
                // For now, we'll map common names to specific indices if needed, or just return args[0].
                if (name === 'artist') return args.join(' '); // artist usually takes the rest
                return args[0] || null;
            },
            getInteger: (name: string) => {
                if (isInteraction) return input.options.getInteger(name);
                const val = args[0] ? parseInt(args[0]) : NaN;
                return isNaN(val) ? null : val;
            },
            getSubcommand: () => {
                if (isInteraction) return input.options.getSubcommand();
                return args[0] || null;
            }
        }
    };

    return context;
}
