/**
 * Module Loader for Sora WebUI (Native & Standard Support)
 * 
 * Handles loading modules with global function interfaces (like ashi.js) 
 * and native Sora scraping modules that use networkFetch.
 * Uses CORS proxy to fetch external resources.
 */

const getCorsProxy = () => {
    const useCustom = localStorage.getItem('useCustomProxy') === 'true';
    return useCustom ? (localStorage.getItem('corsProxy') || '/api/proxy?url=') : '/api/proxy?url=';
};

export class ModuleLoader {

    static async load(manifestInput) {
        let manifest = manifestInput;

        // If input is a string, try to parse it as JSON or fetch it if it's a URL
        if (typeof manifestInput === 'string') {
            manifestInput = manifestInput.trim();
            if (manifestInput.startsWith('http')) {
                const url = getCorsProxy() + encodeURIComponent(manifestInput);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.statusText}`);
                manifest = await res.json();
            } else {
                try {
                    manifest = JSON.parse(manifestInput);
                } catch (e) {
                    throw new Error('Invalid JSON manifest');
                }
            }
        }

        if (!manifest.scriptUrl) {
            throw new Error('Manifest missing "scriptUrl"');
        }

        // Polyfill environment
        this.polyfillEnvironment();

        // Fetch the script via proxy
        const scriptUrl = getCorsProxy() + encodeURIComponent(manifest.scriptUrl);
        const scriptRes = await fetch(scriptUrl);
        if (!scriptRes.ok) throw new Error(`Failed to fetch script: ${scriptRes.statusText}`);
        let code = await scriptRes.text();

        // PATCH: Fix broken domain replacement in ashi.js
        if (code.includes('.replace("megaup22", "megaup.site")')) {
            console.log("Patching module: Removing broken domain replacement");
            code = code.split('.replace("megaup22", "megaup.site")').join('');
        }

        // Execute script in global scope
        try {
            // We'll wrap the code to ensure it runs.
            const executionResult = (0, eval)(code);

            // CHECK 1: Did the script return a standardized module object? (e.g. SampleModule)
            if (executionResult && typeof executionResult.search === 'function') {
                console.log('Module loaded via return value object');
                return {
                    manifest,
                    name: executionResult.name || manifest.sourceName || 'Unknown Module',
                    search: executionResult.search.bind(executionResult),
                    getDetails: executionResult.getDetails.bind(executionResult),
                    getStream: executionResult.getStream.bind(executionResult)
                };
            }

            // CHECK 2: Legacy Global Functions (Sora modules like ashi.js & Native Modules)
            // CRITICAL: Immediately capture references to the functions THIS module just defined
            const capturedFunctions = {
                searchResults: window.searchResults,
                extractDetails: window.extractDetails,
                extractStreamUrl: window.extractStreamUrl,
                extractEpisodes: window.extractEpisodes
            };

            // Now check for the expected global functions and wrap them
            return this.wrapGlobalFunctions(manifest, capturedFunctions);

        } catch (err) {
            console.error('Script execution error:', err);
            throw new Error(`Script execution failed: ${err.message}`);
        }
    }

    static wrapGlobalFunctions(manifest, capturedFunctions) {
        // Check if the standard functions exist
        if (typeof capturedFunctions.searchResults !== 'function') {
            throw new Error('Module did not define "searchResults" global function');
        }

        return {
            manifest,
            name: manifest.sourceName || 'Unknown Module',

            search: async (query) => {
                try {
                    console.log('Calling searchResults with:', query);
                    const res = await capturedFunctions.searchResults(query);
                    const data = typeof res === 'string' ? JSON.parse(res) : res;

                    // Map to our internal format
                    return data.map(item => ({
                        id: item.href, // Use href as ID
                        title: item.title,
                        poster: item.image,
                        type: 'Video', // Default to video
                        description: ''
                    }));
                } catch (e) {
                    console.error('Search error:', e);
                    throw e;
                }
            },

            getDetails: async (id) => {
                try {
                    console.log('Getting details for:', id);

                    // Native modules split this into extractDetails and extractEpisodes
                    const detailsRes = await capturedFunctions.extractDetails(id);
                    const detailsData = typeof detailsRes === 'string' ? JSON.parse(detailsRes) : detailsRes;
                    const details = detailsData[0] || {};

                    let episodes = [];
                    if (typeof capturedFunctions.extractEpisodes === 'function') {
                        const episodesRes = await capturedFunctions.extractEpisodes(id);
                        const episodesData = typeof episodesRes === 'string' ? JSON.parse(episodesRes) : episodesRes;
                        episodes = episodesData.map(ep => ({
                            id: ep.href,
                            title: ep.title || `Episode ${ep.number}`, // Fallback title
                            number: ep.number,
                            season: 1 // Default to season 1
                        }));
                    }

                    return {
                        id,
                        title: details.title || 'Details',
                        description: details.description,
                        // Extract date info for better TMDB matching
                        year: details.year || details.aired || details.premiered || details.releaseDate,
                        episodes: episodes
                    };
                } catch (e) {
                    console.error('GetDetails error:', e);
                    throw e;
                }
            },

            getStream: async (episodeId) => {
                try {
                    console.log('Getting stream for:', episodeId);
                    if (typeof capturedFunctions.extractStreamUrl !== 'function') {
                        throw new Error('Module missing extractStreamUrl');
                    }

                    const streamRes = await capturedFunctions.extractStreamUrl(episodeId);

                    if (!streamRes) return { streams: [], subtitles: '' };

                    // Handle raw URL string return
                    if (typeof streamRes === 'string' && streamRes.startsWith('http')) {
                        return { streams: [{ label: 'Default', url: streamRes }], subtitles: '' };
                    }

                    const streamData = typeof streamRes === 'string' ? JSON.parse(streamRes) : streamRes;

                    // Helper to infer headers (Referer) from the source URL
                    const inferHeaders = () => {
                        // Returning empty to allow "No Referer" behavior which works for direct link access
                        return {};
                    };

                    const inferredHeaders = inferHeaders();

                    let streams = [];
                    let subtitles = [];

                    if (streamData.streams && Array.isArray(streamData.streams)) {
                        // 1. Flat array: ["Label", "URL", "Label", "URL"]
                        if (streamData.streams.length > 0 && typeof streamData.streams[0] === 'string') {
                            for (let i = 0; i < streamData.streams.length; i += 2) {
                                if (i + 1 < streamData.streams.length) {
                                    streams.push({
                                        label: streamData.streams[i],
                                        url: streamData.streams[i + 1],
                                        headers: inferredHeaders
                                    });
                                }
                            }
                        } else {
                            // 2. Object array: [{title, streamUrl}, {label, url}]
                            streams = streamData.streams.map(stream => {
                                if (typeof stream === 'string') return { label: 'Stream', url: stream, headers: inferredHeaders }; // Handle ["url1", "url2"]

                                if (stream.streamUrl || stream.title) {
                                    return {
                                        label: stream.title || 'Unknown',
                                        url: stream.streamUrl,
                                        headers: { ...inferredHeaders, ...(stream.headers || {}) }
                                    };
                                } else if (stream.url || stream.label) {
                                    return {
                                        label: stream.label || 'Default',
                                        url: stream.url,
                                        headers: { ...inferredHeaders, ...(stream.headers || {}) }
                                    };
                                } else if (stream.file) { // JWPlayer style
                                    return {
                                        label: stream.label || 'Default',
                                        url: stream.file,
                                        headers: { ...inferredHeaders, ...(stream.headers || {}) }
                                    };
                                }
                                return null;
                            }).filter(Boolean);
                        }
                    } else if (streamData.stream && typeof streamData.stream === 'object') {
                        // Single stream object
                        streams.push({
                            label: streamData.stream.title || 'Default',
                            url: streamData.stream.streamUrl || streamData.stream.url || streamData.stream.file,
                            headers: { ...inferredHeaders, ...(streamData.stream.headers || {}) }
                        });
                    } else if (streamData.stream && typeof streamData.stream === 'string') {
                        // Single stream string
                        streams.push({ label: 'Default', url: streamData.stream, headers: inferredHeaders });
                    } else if (streamData.url) {
                        // Legacy single url at root
                        streams.push({ label: 'Default', url: streamData.url, headers: { ...inferredHeaders, ...(streamData.headers || {}) } });
                    } else if (streamData.source && Array.isArray(streamData.source)) {
                        // "source" key fallback
                        streams = streamData.source.map(s => ({
                            label: s.label || 'Default',
                            url: s.file || s.url || s.src,
                            headers: { ...inferredHeaders, ...(s.headers || {}) }
                        }));
                    } else if (streamData.sources && Array.isArray(streamData.sources)) {
                        // "sources" key fallback
                        streams = streamData.sources.map(s => ({
                            label: s.label || 'Default',
                            url: s.file || s.url || s.src,
                            headers: { ...inferredHeaders, ...(s.headers || {}) }
                        }));
                    } else if (Array.isArray(streamData)) {
                        // The string/object itself is an array
                        streams = streamData.map(s => {
                            if (s.file) return { label: s.label || 'Default', url: s.file, headers: { ...inferredHeaders, ...(s.headers || {}) } };
                            if (s.url) return { label: s.label || 'Default', url: s.url, headers: { ...inferredHeaders, ...(s.headers || {}) } };
                            return null;
                        }).filter(Boolean);
                    }

                    subtitles = streamData.subtitles || streamData.tracks || [];

                    return {
                        streams,
                        subtitles
                    };
                } catch (e) {
                    console.error('GetStream error:', e);
                    return { streams: [], subtitles: [] };
                }
            }
        };
    }

    static polyfillEnvironment() {
        // Base Fetch Implementation reusing CORS proxy
        const internalFetch = async (url, options = {}) => {
            // Handle simple options being just a timeout number
            if (typeof options === 'number') {
                options = { timeoutSeconds: options };
            }

            const method = options.method || 'GET';
            const headers = options.headers || {};
            const proxyUrl = getCorsProxy() + encodeURIComponent(url);

            const fetchOptions = {
                method,
                headers: { ...headers },
                // Note: body not supported in get request proxy usually, but added if needed
                body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
            };

            console.log(`[Native Polyfill] Fetching: ${url}`);
            try {
                const response = await fetch(proxyUrl, fetchOptions);
                const text = await response.text();

                // Try to capture final URL if proxy returns it in header, otherwise assume original
                const finalUrl = response.headers.get('x-final-url') || url;

                return {
                    originalUrl: finalUrl,
                    requests: [url], // Simplified: we don't track redirects through proxy yet
                    html: text,
                    cookies: null, // Proxy doesn't return cookie jar state easily
                    success: response.ok,
                    error: response.ok ? null : `HTTP ${response.status}`,
                    requests: [url]
                };
            } catch (e) {
                return {
                    originalUrl: url,
                    requests: [url],
                    html: null,
                    cookies: null,
                    success: false,
                    error: e.message
                };
            }
        };

        // --- Native API Polyfills ---

        if (!window.networkFetch) {
            window.networkFetch = (url, options = {}) => {
                return new Promise(async (resolve, reject) => {
                    const result = await internalFetch(url, options);
                    resolve({
                        url: result.originalUrl,
                        requests: result.requests,
                        html: result.html || null,
                        cookies: null, // Cookies not supported via simple proxy
                        success: result.success,
                        error: result.error || null,
                        totalRequests: 1,
                        // Stubbed native fields
                        cutoffTriggered: false,
                        cutoffUrl: null,
                        htmlCaptured: !!result.html,
                        cookiesCaptured: false,
                        elementsClicked: [],
                        waitResults: {}
                    });
                });
            };
        }

        if (!window.networkFetchSimple) {
            window.networkFetchSimple = (url, options = {}) => {
                return new Promise(async (resolve, reject) => {
                    const result = await internalFetch(url, options);
                    resolve({
                        url: result.originalUrl,
                        requests: result.requests,
                        success: result.success,
                        error: result.error || null,
                        totalRequests: 1
                    });
                });
            };
        }

        // Aliases
        if (!window.networkFetchWithHTML) {
            window.networkFetchWithHTML = (url, timeoutSeconds = 10) => window.networkFetch(url, { timeoutSeconds, returnHTML: true });
        }

        if (!window.networkFetchWithCutoff) {
            window.networkFetchWithCutoff = (url, cutoff, timeoutSeconds = 10) => window.networkFetch(url, { cutoff, timeoutSeconds });
        }

        if (!window.networkFetchWithClicks) {
            window.networkFetchWithClicks = (url, clickSelectors, options = {}) => {
                console.warn('[Polyfill] networkFetchWithClicks: Click selectors are not supported in this environment.');
                return window.networkFetch(url, options);
            }
        }

        if (!window.networkFetchFromHTML) {
            window.networkFetchFromHTML = (htmlContent, options = {}) => {
                // Native just returns the HTML passed in mostly for parsing context, 
                // but here we just resolve immediately since we don't have a headless browser
                return Promise.resolve({
                    url: '',
                    requests: [],
                    html: htmlContent,
                    cookies: null,
                    success: true,
                    error: null,
                    htmlCaptured: true
                });
            }
        }

        // Legacy fetchv2 support (Optimized & Robust)
        if (!window.fetchv2) {
            window.fetchv2 = async (url, headers = {}, method = 'GET', body = null) => {
                if (!url) {
                    console.error('[Polyfill] fetchv2 called with undefined URL');
                    return { ok: false, status: 0, text: () => Promise.resolve(''), json: () => Promise.resolve({}) };
                }

                const proxyUrl = getCorsProxy() + encodeURIComponent(url);

                // Smart Body Serialization
                let finalBody = body;
                let finalHeaders = { ...headers };

                // Header Tunneling for Forbidden Headers (Cookie, User-Agent, Referer, Origin)
                // Browser fetch drops these, so we send them as X-Proxy-* and the proxy restores them.
                const forbiddenMap = {
                    'cookie': 'X-Proxy-Cookie',
                    'user-agent': 'X-Proxy-User-Agent',
                    'referer': 'X-Proxy-Referer',
                    'origin': 'X-Proxy-Origin'
                };

                Object.keys(finalHeaders).forEach(key => {
                    const lowerKey = key.toLowerCase();
                    if (forbiddenMap[lowerKey]) {
                        finalHeaders[forbiddenMap[lowerKey]] = finalHeaders[key];
                        // We don't delete the original, browser will ignore it anyway, but cleaner to keep intention
                    }
                });

                if (body && typeof body === 'object') {
                    const contentType = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
                    const contentTypeValue = contentType ? headers[contentType].toLowerCase() : '';

                    if (contentTypeValue.includes('application/x-www-form-urlencoded')) {
                        // Convert object to URLSearchParams string
                        finalBody = new URLSearchParams(body).toString();
                    } else if (contentTypeValue.includes('application/json') || !contentTypeValue) {
                        // Default to JSON if JSON header or no header
                        // Note: Some modules might rely on implicit JSON
                        finalBody = JSON.stringify(body);
                        if (!contentTypeValue) {
                            finalHeaders['Content-Type'] = 'application/json';
                        }
                    } else if (contentTypeValue.includes('multipart/form-data')) {
                        // Let fetch handle multipart (usually don't stringify)
                        // But proxying multipart is hard.
                        // Warning: This might fail depending on proxy implementation
                        finalBody = body instanceof FormData ? body : finalBody;
                        // Remove Content-Type to let browser set boundary
                        delete finalHeaders[contentType];
                    }
                }

                const options = {
                    method,
                    headers: finalHeaders,
                    body: finalBody
                };

                // console.log(`[Polyfill] fetchv2: ${method} ${url}`, { headers: finalHeaders, bodyLength: finalBody ? finalBody.length : 0 });

                try {
                    const response = await fetch(proxyUrl, options);

                    if (!response.ok) {
                        const errorText = await response.clone().text();
                        console.warn(`[Polyfill] fetchv2 failed: ${response.status} ${response.statusText} for ${url}`, errorText);
                    }

                    return {
                        text: () => response.text(),
                        json: () => response.json(),
                        status: response.status,
                        ok: response.ok
                    };
                } catch (e) {
                    console.error(`[Polyfill] fetchv2 network error:`, e);
                    return {
                        text: () => Promise.resolve(''),
                        json: () => Promise.resolve({}),
                        status: 0,
                        ok: false
                    };
                }
            };
        }

        if (!window.atob) window.atob = (str) => Buffer.from(str, 'base64').toString('binary');
        if (!window.btoa) window.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
    }
}
