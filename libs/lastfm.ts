import dotenv from 'dotenv';

dotenv.config();

const FMKEY = process.env.FMKEY || '';
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

export interface LastFmTrack {
    name: string;
    artist: {
        '#text': string;
        mbid?: string;
    };
    album?: {
        '#text': string;
        mbid?: string;
    };
    image?: Array<{
        '#text': string;
        size: string;
    }>;
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
    image?: Array<{
        '#text': string;
        size: string;
    }>;
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
    image?: Array<{
        '#text': string;
        size: string;
    }>;
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
    image?: Array<{
        '#text': string;
        size: string;
    }>;
}

async function makeRequest(params: Record<string, string>): Promise<any> {
    const url = new URL(BASE_URL);
    url.searchParams.append('api_key', FMKEY);
    url.searchParams.append('format', 'json');

    for (const [key, value] of Object.entries(params)) {
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

export async function getRecentTracks(username: string, limit: number = 10): Promise<LastFmTrack[]> {
    const data = await makeRequest({
        method: 'user.getrecenttracks',
        user: username,
        limit: limit.toString(),
    });

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
    const data = await makeRequest({
        method: 'user.gettopartists',
        user: username,
        period: period,
        limit: limit.toString(),
    });

    if (!data.topartists || !data.topartists.artist) {
        return [];
    }

    const artists = Array.isArray(data.topartists.artist)
        ? data.topartists.artist
        : [data.topartists.artist];

    return artists;
}

export async function getTopTracks(username: string, period: string = 'overall', limit: number = 10): Promise<LastFmTrack[]> {
    const data = await makeRequest({
        method: 'user.gettoptracks',
        user: username,
        period: period,
        limit: limit.toString(),
    });

    if (!data.toptracks || !data.toptracks.track) {
        return [];
    }

    const tracks = Array.isArray(data.toptracks.track)
        ? data.toptracks.track
        : [data.toptracks.track];

    return tracks;
}

export async function getTopAlbums(username: string, period: string = 'overall', limit: number = 10): Promise<LastFmAlbum[]> {
    const data = await makeRequest({
        method: 'user.gettopalbums',
        user: username,
        period: period,
        limit: limit.toString(),
    });

    if (!data.topalbums || !data.topalbums.album) {
        return [];
    }

    const albums = Array.isArray(data.topalbums.album)
        ? data.topalbums.album
        : [data.topalbums.album];

    return albums;
}

export async function getUserInfo(username: string): Promise<LastFmUser> {
    const data = await makeRequest({
        method: 'user.getinfo',
        user: username,
    });

    if (!data.user) {
        throw new Error('User not found');
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

    const data = await makeRequest(params);
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

    const data = await makeRequest(params);
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

    const data = await makeRequest(params);
    return data.track;
}

export function getImageUrl(images?: Array<{ '#text': string; size: string }>): string | null {
    if (!images || images.length === 0) {
        return null;
    }

    // Prefer extralarge, then large, then medium
    const extralarge = images.find(img => img.size === 'extralarge');
    if (extralarge && extralarge['#text']) return extralarge['#text'];

    const large = images.find(img => img.size === 'large');
    if (large && large['#text']) return large['#text'];

    const medium = images.find(img => img.size === 'medium');
    if (medium && medium['#text']) return medium['#text'];

    const lastImage = images[images.length - 1];
    return (lastImage && lastImage['#text']) || null;
}
