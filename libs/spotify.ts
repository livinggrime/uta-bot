import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || ''; // Can be overridden by env but user specified this

let clientAccessToken: string | null = null;
let clientTokenExpiresAt: number = 0;

// === Authentication ===

export function getSpotifyAuthorizationUrl(state: string): string {
    const scopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-top-read'
    ];

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scopes.join(' '),
        redirect_uri: REDIRECT_URI,
        state: state
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<any> {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
    });

    const headers = {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: headers,
        body: params
    });

    return await response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<any> {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const headers = {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: headers,
        body: params
    });

    return await response.json();
}

async function getClientCredentialsToken(): Promise<string> {
    if (clientAccessToken && Date.now() < clientTokenExpiresAt) {
        return clientAccessToken;
    }

    const params = new URLSearchParams({
        grant_type: 'client_credentials'
    });

    const headers = {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: headers,
        body: params
    });

    const data: any = await response.json();
    if (data.access_token) {
        clientAccessToken = data.access_token;
        clientTokenExpiresAt = Date.now() + (data.expires_in * 1000);
        return clientAccessToken as string;
    } else {
        throw new Error('Failed to get Spotify client token');
    }
}

// === API Calls ===

async function spotifyRequest(endpoint: string, accessToken: string, method: string = 'GET', body?: any): Promise<any> {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };

    const options: any = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, options);

    if (response.status === 204) return null; // No content

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Spotify API error ${response.status}: ${errorText}`);
    }

    return await response.json();
}

// Fallback search for images
export async function searchSpotifyImage(query: string, type: 'artist' | 'album' | 'track'): Promise<string | null> {
    try {
        const token = await getClientCredentialsToken();
        const searchParams = new URLSearchParams({
            q: query,
            type: type,
            limit: '1'
        });

        const data = await spotifyRequest(`/search?${searchParams.toString()}`, token);

        let items: any[] = [];
        if (type === 'artist') items = data.artists.items;
        else if (type === 'album') items = data.albums.items;
        else if (type === 'track') items = data.tracks.items;

        if (items.length > 0) {
            const item = items[0];
            const images = type === 'track' ? item.album.images : item.images;
            if (images && images.length > 0) {
                return images[0].url; // Usually the largest image
            }
        }
        return null;
    } catch (error) {
        console.error('Spotify Search Error:', error);
        return null;
    }
}

// User playback controls
export const SpotifyPlayer = {
    getNowPlaying: async (accessToken: string) => spotifyRequest('/me/player/currently-playing', accessToken, 'GET'),
    play: async (accessToken: string) => spotifyRequest('/me/player/play', accessToken, 'PUT'),
    pause: async (accessToken: string) => spotifyRequest('/me/player/pause', accessToken, 'PUT'),
    next: async (accessToken: string) => spotifyRequest('/me/player/next', accessToken, 'POST'),
    previous: async (accessToken: string) => spotifyRequest('/me/player/previous', accessToken, 'POST'),
    // Add more as needed
};
