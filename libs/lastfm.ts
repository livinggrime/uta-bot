import dotenv from "dotenv";
import { searchSpotifyImage } from "./spotify";
import { lastfmCache, requestDeduplicator } from "./cache";

dotenv.config();

const FMKEY = process.env.FMKEY || '';
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

export interface RawImage {
    size: string;
    "#text": string;
}
export interface LastFmTrack {
    name: string;
    artist: {
        name?: string;
        '#text'?: string;
        mbid?: string;
        url?: string;
    };
    album?: {
        '#text': string;
        mbid?: string;
    };
    image?: RawImage[];
    url?: string;
    playcount?: string;
    '@attr'?: {
        nowplaying?: string;
    };
    date?: {
        uts: string;
        '#text': string;
    };
}

export interface LastFmArtist {
    name: string;
    playcount: string;
    url: string;
    image?: RawImage[];
    mbid?: string;
}

export interface LastFmAlbum {
    name: string;
    artist: {
        name: string;
        mbid?: string;
        url?: string;
    };
    playcount: string;
    url: string;
    image?: RawImage[];
    mbid?: string;
}

export interface LastFmUser {
    name: string;
    realname?: string;
    url: string;
    country?: string;
    playcount: string;
    artist_count?: string;
    registered: {
        unixtime: string;
        '#text': number;
    };
    image?: string | RawImage[];
}

const pendingRequests = new Map<string, Promise<any>>();

async function makeRequestWithRetry(params: Record<string, string>, ttl?: number, retries: number = 2): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await makeRequest(params, ttl);
        } catch (error: any) {
            lastError = error;
            
            // Don't retry on certain errors
            if (error.message.includes('User not found') || 
                error.message.includes('rate limit exceeded') ||
                error.message.includes('Invalid Last.fm API response')) {
                throw error;
            }
            
            // Exponential backoff for retries
            if (attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

function createCacheKey(params: Record<string, string>): string {
    const sortedParams: Record<string, string> = {};
    const sortedKeys = Object.keys(params).sort();
    
    for (const key of sortedKeys) {
        const value = params[key];
        if (value !== null && value !== undefined && value !== '') {
            sortedParams[key] = value;
        }
    }
    
    return JSON.stringify(sortedParams);
}

async function makeRequest(params: Record<string, string>, ttl?: number): Promise<any> {
    const cacheKey = createCacheKey(params);
    
    const cached = lastfmCache.get(cacheKey);
    if (cached) return cached;

    return requestDeduplicator.deduplicate(cacheKey, async () => {
        const url = new URL(BASE_URL);
        url.searchParams.append('api_key', FMKEY);
        url.searchParams.append('format', 'json');

        // Validate required parameters
        if (!params.method) {
            throw new Error('Last.fm API method is required');
        }

        for (const [key, value] of Object.entries(params)) {
            // Skip null/undefined values
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.append(key, value);
            }
        }

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url.toString(), {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'UTABot/1.0'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Handle specific HTTP errors
                if (response.status === 429) {
                    throw new Error('Last.fm API rate limit exceeded. Please try again later.');
                } else if (response.status >= 500) {
                    throw new Error('Last.fm API server error. Please try again later.');
                } else {
                    throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
                }
            }

            const data: any = await response.json();

            if (data.error) {
                // Handle specific Last.fm API errors
                if (data.error === 6) {
                    throw new Error('User not found or does not exist.');
                } else if (data.error === 8) {
                    throw new Error('Operation failed. Please try again.');
                } else {
                    throw new Error(`Last.fm API error: ${data.message || data.error}`);
                }
            }

            // Validate response structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid Last.fm API response');
            }

            lastfmCache.set(cacheKey, data, ttl);
            return data;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error?.name === 'AbortError') {
                throw new Error('Last.fm API request timeout');
            }
            throw error;
        }
    });
}

export async function getRecentTracks(username: string, limit: number = 10): Promise<LastFmTrack[]> {
    const data = await makeRequestWithRetry({
        method: 'user.getrecenttracks',
        user: username,
        limit: limit.toString(),
    }, 60000);

    if (!data.recenttracks || !data.recenttracks.track) {
        return [];
    }

    const tracks = Array.isArray(data.recenttracks.track)
        ? data.recenttracks.track
        : [data.recenttracks.track];

    return tracks;
}

export async function getNowPlaying(username: string): Promise<LastFmTrack | null> {
    const tracks = await getRecentTracks(username, 1);

    if (tracks.length === 0) {
        return null;
    }

    return tracks[0] || null;
}

export async function getTopArtists(username: string, period: string = 'overall', limit: number = 10): Promise<LastFmArtist[]> {
    const data = await makeRequestWithRetry({
        method: 'user.gettopartists',
        user: username,
        period: period,
        limit: limit.toString(),
    }, 1800000);

    if (!data.topartists || !data.topartists.artist) {
        return [];
    }

    const artists = Array.isArray(data.topartists.artist)
        ? data.topartists.artist
        : [data.topartists.artist];

    return artists;
}

export async function getTopTracks(username: string, period: string = 'overall', limit: number = 10): Promise<LastFmTrack[]> {
    const data = await makeRequestWithRetry({
        method: 'user.gettoptracks',
        user: username,
        period: period,
        limit: limit.toString(),
    }, 1800000);

    if (!data.toptracks || !data.toptracks.track) {
        return [];
    }

    return Array.isArray(data.toptracks.track)
        ? data.toptracks.track
        : [data.toptracks.track];
}

export async function getTopAlbums(username: string, period: string = 'overall', limit: number = 10): Promise<LastFmAlbum[]> {
    const data = await makeRequestWithRetry({
        method: 'user.gettopalbums',
        user: username,
        period: period,
        limit: limit.toString(),
    }, 1800000);

    if (!data.topalbums || !data.topalbums.album) {
        return [];
    }

    const albums = Array.isArray(data.topalbums.album)
        ? data.topalbums.album
        : [data.topalbums.album];

    return albums;
}

export async function getUserInfo(username: string): Promise<LastFmUser> {
    const data = await makeRequestWithRetry({
        method: 'user.getinfo',
        user: username,
    });

    if (!data.user) {
        throw new Error('User not found: ${username}');
    }

    return data.user;
}

export async function getArtistInfo(artist: string, username?: string): Promise<any> {
    const params: Record<string, string> = {
        method: 'artist.getinfo',
        artist: artist,
    };

    if (username) {
        params.username = username;
    }

    const data = await makeRequestWithRetry(params, 3600000);
    return data.artist;
}

export async function getAlbumInfo(artist: string, album: string, username?: string): Promise<any> {
    const params: Record<string, string> = {
        method: 'album.getinfo',
        artist: artist,
        album: album,
    };

    if (username) {
        params.username = username;
    }

    const data = await makeRequestWithRetry(params, 3600000);
    return data.album;
}

export async function getTrackInfo(artist: string, track: string, username?: string): Promise<any> {
    const params: Record<string, string> = {
        method: 'track.getinfo',
        artist: artist,
        track: track,
    };

    if (username) {
        params.username = username;
    }

    const data = await makeRequestWithRetry(params, 3600000);
    return data.track;
}

export async function getImageUrl(images?: string | Array<{ '#text': string; size: string }>, type?: 'artist' | 'album' | 'track', artistName?: string, itemName?: string): Promise<string | null> {
    let url: string | null = null;

    if (images) {
        // Sometimes it's just a string URL (rare legacy format or user-provided)
        if (typeof images === 'string') {
            url = images.length > 0 ? images : null;
        } else if (images.length > 0) {
            // Check for animated GIFs first - prioritize them over static images
            const gifImage = images.find(img => 
                img['#text'] && img['#text'].toLowerCase().includes('.gif')
            );
            if (gifImage && gifImage['#text']) {
                url = gifImage['#text'];
            } else {
                // Prefer extralarge, then large, then medium for static images
                const sizeOrder = ['extralarge', 'large', 'medium', 'small'];
                for (const size of sizeOrder) {
                    const img = images.find(img => img.size === size);
                    if (img && img['#text'] && !img['#text'].includes('2a96cbd8b46e442fc41c2b86b821562f')) {
                        url = img['#text'];
                        break;
                    }
                }
                
                // Fallback to last available image
                if (!url) {
                    const lastImage = images[images.length - 1];
                    if (lastImage && lastImage['#text']) {
                        url = lastImage['#text'];
                    }
                }
            }
        }
    }

    // Check if we have a valid URL
    const isPlaceholder = !url || url.includes('2a96cbd8b46e442fc41c2b86b821562f') || url.length === 0;

    if (isPlaceholder && type && artistName) {
        // Query Spotify for fallback image
        const query = type === 'artist' ? artistName : `${artistName} ${itemName || ''}`;
        const spotifyUrl = await searchSpotifyImage(query.trim(), type);
        if (spotifyUrl) return spotifyUrl;
    }

    return url;
}
