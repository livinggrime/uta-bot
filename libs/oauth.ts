import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const FMKEY = process.env.FMKEY || '';
const FMSECRET = process.env.FMSECRET || '';
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

/**
 * Generate MD5 API signature for Last.fm authenticated requests
 * Parameters must be sorted alphabetically before hashing
 */
export function generateSignature(params: Record<string, string>): string {
    // Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();

    // Concatenate key-value pairs
    let signatureString = '';
    for (const key of sortedKeys) {
        signatureString += key + params[key];
    }

    // Append secret and hash
    signatureString += FMSECRET;

    return crypto.createHash('md5').update(signatureString, 'utf8').digest('hex');
}

/**
 * Make an authenticated request to Last.fm API
 */
async function makeAuthenticatedRequest(params: Record<string, string>, method: 'GET' | 'POST' = 'POST'): Promise<any> {
    const requestParams: Record<string, string> = {
        ...params,
        api_key: FMKEY,
    };

    // Generate signature
    const signature = generateSignature(requestParams);
    requestParams['api_sig'] = signature;
    requestParams['format'] = 'json';

    if (method === 'POST') {
        const formData = new URLSearchParams(requestParams);

        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();

        if (data.error) {
            throw new Error(`Last.fm API error: ${data.message}`);
        }

        return data;
    } else {
        const url = new URL(BASE_URL);
        for (const [key, value] of Object.entries(requestParams)) {
            url.searchParams.append(key, value);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();

        if (data.error) {
            throw new Error(`Last.fm API error: ${data.message}`);
        }

        return data;
    }
}

/**
 * Step 1: Get an authentication token
 */
export async function getAuthToken(): Promise<string> {
    const data = await makeAuthenticatedRequest({
        method: 'auth.getToken',
    }, 'GET');

    if (!data.token) {
        throw new Error('Failed to get authentication token');
    }

    return data.token;
}

/**
 * Step 2: Generate authorization URL for user
 */
export function getAuthorizationUrl(token: string): string {
    const callback = process.env.OAUTH_CALLBACK_URL;
    const cbParam = callback ? `&cb=${encodeURIComponent(callback)}` : '';
    return `https://www.last.fm/api/auth/?api_key=${FMKEY}&token=${token}${cbParam}`;
}

/**
 * Step 3: Exchange token for session key after user authorizes
 */
export async function getSessionKey(token: string): Promise<{ sessionKey: string; username: string }> {
    const data = await makeAuthenticatedRequest({
        method: 'auth.getSession',
        token: token,
    }, 'GET');

    if (!data.session) {
        throw new Error('Failed to get session key');
    }

    return {
        sessionKey: data.session.key,
        username: data.session.name,
    };
}

/**
 * Scrobble a track to Last.fm
 */
export async function scrobbleTrack(
    sessionKey: string,
    track: string,
    artist: string,
    timestamp: number,
    album?: string,
    albumArtist?: string
): Promise<void> {
    const params: Record<string, string> = {
        method: 'track.scrobble',
        sk: sessionKey,
        'track[0]': track,
        'artist[0]': artist,
        'timestamp[0]': timestamp.toString(),
    };

    if (album) {
        params['album[0]'] = album;
    }

    if (albumArtist) {
        params['albumArtist[0]'] = albumArtist;
    }

    await makeAuthenticatedRequest(params, 'POST');
}

/**
 * Update now playing status
 */
export async function updateNowPlaying(
    sessionKey: string,
    track: string,
    artist: string,
    album?: string,
    albumArtist?: string
): Promise<void> {
    const params: Record<string, string> = {
        method: 'track.updateNowPlaying',
        sk: sessionKey,
        track: track,
        artist: artist,
    };

    if (album) {
        params.album = album;
    }

    if (albumArtist) {
        params.albumArtist = albumArtist;
    }

    await makeAuthenticatedRequest(params, 'POST');
}

/**
 * Love a track
 */
export async function loveTrack(
    sessionKey: string,
    track: string,
    artist: string
): Promise<void> {
    await makeAuthenticatedRequest({
        method: 'track.love',
        sk: sessionKey,
        track: track,
        artist: artist,
    }, 'POST');
}

/**
 * Unlove a track
 */
export async function unloveTrack(
    sessionKey: string,
    track: string,
    artist: string
): Promise<void> {
    await makeAuthenticatedRequest({
        method: 'track.unlove',
        sk: sessionKey,
        track: track,
        artist: artist,
    }, 'POST');
}
