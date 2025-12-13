import { URL } from 'url';

export const config = {
    api: {
        bodyParser: false, // Disable Vercel's body parser to handle streams/buffers manually if needed
        externalResolver: true,
    },
};

export default async function handler(req, res) {
    console.log('[Proxy] Handler HIT - Method:', req.method, 'URL:', req.url);

    try {
        // Parse the URL to get the target 'url' query parameter
        // req.url in Vercel is relative, e.g. /api/proxy?url=...
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const targetUrl = urlObj.searchParams.get('url');

        if (!targetUrl) {
            console.log('[Proxy] ERROR: Missing url parameter');
            res.statusCode = 400;
            res.end('Missing url query parameter. Req url: ' + req.url);
            return;
        }

        console.log(`[Proxy] Proxying: ${targetUrl}`);

        const cleanHeaders = { ...req.headers };
        // Remove problematic headers
        ['host', 'origin', 'referer', 'accept-encoding', 'connection', 'content-length', 'cookie',
            'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'].forEach(header => {
                delete cleanHeaders[header];
            });

        // Restore Tunnelled Headers
        const tunnelMap = {
            'x-proxy-cookie': 'Cookie',
            'x-proxy-user-agent': 'User-Agent',
            'x-proxy-referer': 'Referer',
            'x-proxy-origin': 'Origin'
        };

        console.log('[Proxy] Incoming X-Proxy-Referer:', cleanHeaders['x-proxy-referer']);

        Object.keys(tunnelMap).forEach(proxyKey => {
            if (cleanHeaders[proxyKey]) {
                cleanHeaders[tunnelMap[proxyKey]] = cleanHeaders[proxyKey];
                delete cleanHeaders[proxyKey];
            }
        });

        const targetUrlObj = new URL(targetUrl);

        // Default to client User-Agent if not tunnelled
        if (!cleanHeaders['User-Agent']) cleanHeaders['User-Agent'] = req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        const fetchOptions = {
            method: req.method,
            headers: cleanHeaders,
            redirect: 'follow'
        };

        // Forward request body for POST/PUT/PATCH requests
        // Since we disabled bodyParser, req is a stream we can read
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            if (chunks.length > 0) {
                fetchOptions.body = Buffer.concat(chunks);
            }
        }

        console.log(`[Proxy] Forwarding ${req.method} to ${targetUrl}`);
        // console.log('[Proxy] Outgoing Headers:', JSON.stringify(cleanHeaders, null, 2));

        const response = await fetch(targetUrl, fetchOptions);

        res.statusCode = response.status;
        res.statusMessage = response.statusText;

        // Forward response headers
        response.headers.forEach((value, key) => {
            if (['content-encoding', 'access-control-allow-origin', 'content-length'].includes(key.toLowerCase())) return;
            res.setHeader(key, value);
        });

        // Set CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('X-Final-Url', response.url);

        // Determine body handling
        const contentType = response.headers.get('content-type');
        const isM3u8 = targetUrl.includes('.m3u8') || (contentType && (contentType.includes('mpegurl') || contentType.includes('x-mpegURL')));

        if (isM3u8) {
            // Read the entire m3u8 file to rewrite relative URLs
            console.log('[Proxy] Detected m3u8 file, rewriting URLs...');
            const text = await response.text();

            // Parse the base URL for resolving relative paths
            const baseUrl = new URL(targetUrl);
            const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

            // Rewrite relative URLs to absolute proxied URLs
            const rewrittenText = text.split('\n').map(line => {
                if (line.startsWith('#') || !line.trim()) {
                    return line;
                }

                if (line.trim()) {
                    // If it's already an absolute URL, proxy it
                    if (line.startsWith('http://') || line.startsWith('https://')) {
                        return `/api/proxy?url=${encodeURIComponent(line.trim())}`;
                    }

                    // It's a relative URL - construct absolute URL and proxy it
                    const absoluteUrl = new URL(line.trim(), baseUrl.origin + basePath).href;
                    return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                }
                return line;
            }).join('\n');

            console.log('[Proxy] Rewrote m3u8 URLs');
            res.setHeader('Content-Length', Buffer.byteLength(rewrittenText));
            res.write(rewrittenText);
            res.end();
        } else if (response.body) {
            // Stream non-m3u8 content
            // Note: Node's fetch response.body is a Web ReadableStream
            const reader = response.body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
            } catch (streamErr) {
                console.error('[Proxy] Stream Error:', streamErr);
            }
            res.end();
        } else {
            res.end();
        }

    } catch (err) {
        console.error('[Proxy] Critical Error:', err);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message, stack: err.stack }));
        } else {
            res.end();
        }
    }
}
