import http from 'http';
import { URL } from 'url';
import { getSessionKey } from './libs/oauth';
import { saveUser } from './libs/userdata';


const PORT = parseInt(process.env.PORT || process.env.OAUTH_PORT || '3001');


interface PendingAuth {
    token: string;
    discordUserId: string;
    resolve: (success: boolean) => void;
}

const pendingAuths = new Map<string, PendingAuth>();


const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const pathname = url.pathname.replace(/\/$/, '');

    console.log(`[HTTP] ${req.method} ${url.pathname}`);

    if (pathname === '/callback') {
        const token = url.searchParams.get('token');
        console.log(`[OAuth] Received callback with token: ${token}`);


        if (!token) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Error: No token provided</h1></body></html>');
            return;
        }

        const pending = pendingAuths.get(token);

        if (!pending) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Error: Invalid or expired token</h1></body></html>');
            return;
        }

        try {
            // Exchange token for session key
            const { sessionKey, username } = await getSessionKey(token);

            // Save user data to MongoDB
            await saveUser(pending.discordUserId, {
                username: username,
                sessionKey: sessionKey,
                authorizedAt: new Date().toISOString(),
            });
            console.log(`[OAuth] Successfully linked Last.fm account ${username} to Discord user ${pending.discordUserId}`);


            // Resolve the promise
            pending.resolve(true);
            pendingAuths.delete(token);

            // Send success page
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authorization Successful</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        body {
                            font-family: 'Inter', sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background-color: #0f0f0f;
                            color: white;
                        }
                        .container {
                            background: #1a1a1a;
                            padding: 48px;
                            border-radius: 24px;
                            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                            text-align: center;
                            max-width: 400px;
                            width: 90%;
                            border: 1px solid #333;
                        }
                        .icon {
                            font-size: 64px;
                            margin-bottom: 24px;
                            background: linear-gradient(135deg, #ff4b2b 0%, #ff416c 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                        }
                        h1 {
                            font-size: 28px;
                            font-weight: 700;
                            margin: 0 0 12px 0;
                            letter-spacing: -0.5px;
                        }
                        p {
                            color: #a0a0a0;
                            font-size: 16px;
                            line-height: 1.6;
                            margin-bottom: 32px;
                        }
                        .username {
                            color: #ff4b2b;
                            font-weight: 600;
                        }
                        .btn {
                            display: block;
                            background: linear-gradient(135deg, #ff4b2b 0%, #ff416c 100%);
                            color: white;
                            text-decoration: none;
                            padding: 14px 28px;
                            border-radius: 12px;
                            font-weight: 600;
                            transition: transform 0.2s;
                        }
                        .btn:hover {
                            transform: translateY(-2px);
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✓</div>
                        <h1>Linked!</h1>
                        <p>Your Last.fm account <span class="username">${username}</span> has been successfully connected to Discord.</p>
                        <p style="font-size: 14px; margin-bottom: 0;">You can safely close this tab now.</p>
                    </div>
                </body>
                </html>
            `);
        } catch (error: any) {
            console.error('Error completing OAuth flow:', error);

            pending.resolve(false);
            pendingAuths.delete(token);

            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authorization Failed</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        body {
                            font-family: 'Inter', sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background-color: #0f0f0f;
                            color: white;
                        }
                        .container {
                            background: #1a1a1a;
                            padding: 48px;
                            border-radius: 24px;
                            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                            text-align: center;
                            max-width: 400px;
                            width: 90%;
                            border: 1px solid #333;
                        }
                        .icon {
                            font-size: 64px;
                            margin-bottom: 24px;
                            color: #ff4b2b;
                        }
                        h1 {
                            font-size: 28px;
                            font-weight: 700;
                            margin: 0 0 12px 0;
                            letter-spacing: -0.5px;
                        }
                        p {
                            color: #a0a0a0;
                            font-size: 16px;
                            line-height: 1.6;
                            margin-bottom: 32px;
                        }
                        .btn {
                            display: inline-block;
                            background: #333;
                            color: white;
                            text-decoration: none;
                            padding: 14px 28px;
                            border-radius: 12px;
                            font-weight: 600;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✕</div>
                        <h1>Link Failed</h1>
                        <p>There was an error connecting your account. Please head back to Discord and try again.</p>
                        <a href="#" class="btn" onclick="window.close()">Close Tab</a>
                    </div>
                </body>
                </html>
            `);
        }
    } else if (pathname === '/health' || pathname === '') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

export function startOAuthServer(): void {
    server.listen(PORT, () => {
        console.log(`[OAuth Server] Listening on http://localhost:${PORT}`);
    });
}

export function registerPendingAuth(token: string, discordUserId: string): Promise<boolean> {
    return new Promise((resolve) => {
        pendingAuths.set(token, {
            token,
            discordUserId,
            resolve,
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            if (pendingAuths.has(token)) {
                pendingAuths.delete(token);
                resolve(false);
            }
        }, 5 * 60 * 1000);
    });
}
