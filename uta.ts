import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {Client, Collection, GatewayIntentBits, Partials} from "discord.js";
import {startOAuthServer} from './oauth-server';
import {connectToDatabase} from './libs/database';
import {commandCache} from './libs/cache';


const TOKEN = process.env.TOKEN || '';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
    ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Schedule cleanup for cooldowns every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [userId, cooldowns] of (client.cooldowns as any).entries()) {
        const activeCooldowns = new Collection();
        for (const [commandId, endTime] of (cooldowns as any).entries()) {
            if (endTime > now) {
                activeCooldowns.set(commandId, endTime);
            }
        }
        if (activeCooldowns.size > 0) {
            (client.cooldowns as any).set(userId, activeCooldowns);
        } else {
            (client.cooldowns as any).delete(userId);
        }
    }
}, 300000);

// Connect to MongoDB
await connectToDatabase();

client.login(TOKEN).catch((error) => {
    console.error('Error logging in:', error);
});

// Start the OAuth server for Last.fm authorization
startOAuthServer();


const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = await import(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if (command.default && command.default.data && command.default.execute) {
            client.commands.set(command.default.data.name, command.default);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(filePath);
    if (event.default && event.default.name && event.default.execute) {
        if (event.default.once) {
            client.once(event.default.name, (...args: any) => event.default.execute(...args));
        } else {
            client.on(event.default.name, (...args: any) => event.default.execute(...args));
        }
    } else {
        console.log(`[WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`);
    }
}