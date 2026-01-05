
import { Client } from 'discord.js';
import { Collection } from 'discord.js';
import { Command } from './Command'; // Your command structure

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
        cooldowns: Collection<string, Collection<string, number>>;
    }
}