import http from 'http';
import { URL } from 'url';
import { getSessionKey } from './libs/oauth';
import { loadUsers, saveUsers } from './libs/userdata';


const PORT = parseInt(process.env.OAUTH_PORT || '3001');


interface PendingAuth {
    token: string;
    discordUserId: string;
    resolve: (success: boolean) => void;
}

const pendingAuths = new Map<string, PendingAuth>();


const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);

    if (url.pathname === '/callback') {
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

            // Save session key
            const users = loadUsers();
            users[pending.discordUserId] = {
                username: username,
                sessionKey: sessionKey,
                authorizedAt: new Date().toISOString(),
            };
            saveUsers(users);
            console.log(`[OAuth] Successfully linked Last.fm account ${username} to Discord user ${pending.discordUserId}`);


            // Resolve the promise
            pending.resolve(true);
            pendingAuths.delete(token);

            // Send success page
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                <head>
                    <title>Last.fm Authorization Successful</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            text-align: center;
                            max-width: 500px;
                        }
                        h1 {
                            color: #d51007;
                            margin-bottom: 20px;
                        }
                        p {
                            color: #666;
                            font-size: 18px;
                            margin-bottom: 10px;
                        }
                        .username {
                            color: #667eea;
                            font-weight: bold;
                        }
                        .success-icon {
                            font-size: 60px;
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success-icon">✅</div>
                        <h1>Authorization Successful!</h1>
                        <p>Your Last.fm account <span class="username">${username}</span> has been linked.</p>
                        <p>You can now close this window and return to Discord.</p>
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
                <html>
                <head>
                    <title>Last.fm Authorization Failed</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            text-align: center;
                            max-width: 500px;
                        }
                        h1 {
                            color: #f5576c;
                            margin-bottom: 20px;
                        }
                        p {
                            color: #666;
                            font-size: 16px;
                        }
                        .error-icon {
                            font-size: 60px;
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="error-icon">❌</div>
                        <h1>Authorization Failed</h1>
                        <p>There was an error linking your Last.fm account.</p>
                        <p>Please try again using the /setfm command.</p>
                    </div>
                </body>
                </html>
            `);
        }
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
