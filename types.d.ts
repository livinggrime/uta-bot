import {Collection} from 'discord.js';

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
        cooldowns: Collection<string, Collection<string, number>>;
    }
}