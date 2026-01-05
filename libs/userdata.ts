import fs from 'node:fs';
import path from 'node:path';

const USERS_FILE = path.join(__dirname, '../lastfm-users.json');

export interface UserData {
    username: string;
    sessionKey: string;
    authorizedAt: string;
}

export function loadUsers(): Record<string, UserData> {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export function saveUsers(users: Record<string, UserData>): void {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function getUserData(discordUserId: string): UserData | null {
    const users = loadUsers();
    return users[discordUserId] || null;
}
