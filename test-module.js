
// Node 22 has global fetch.
// We are in ESM mode.

// Mock window
const window = {
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    fetchv2: null // Will be polyfilled
};

// Polyfill fetchv2
window.fetchv2 = async (url, headers = {}, method = 'GET', body = null) => {
    // Direct fetch in Node
    const proxyUrl = url;

    const options = {
        method,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...headers,
        },
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    };

    console.log(`fetchv2 direct: ${url}`);
    try {
        const response = await fetch(proxyUrl, options);
        const text = await response.text();
        // console.log(`Response from ${url}:`, text.substring(0, 200));

        return {
            text: () => Promise.resolve(text),
            json: () => {
                try {
                    return Promise.resolve(JSON.parse(text));
                } catch (e) {
                    console.error(`JSON Parse Error for ${url}:`, e.message);
                    throw e;
                }
            },
            status: response.status,
            ok: response.ok
        };
    } catch (e) {
        console.error("Fetch error:", e);
        throw e;
    }
};
global.fetchv2 = window.fetchv2;

// Global scope for eval
global.window = window;
global.fetch = fetch; // Ensure fetch is available

async function runTest() {
    const MANIFEST_URL = 'https://jormungandr.ofchaos.com/releases/sora/recommended/Jorm.json';

    console.log("Fetching manifest...");
    const manifestRes = await fetch(MANIFEST_URL);
    const manifest = await manifestRes.json();
    console.log("Manifest loaded:", manifest.sourceName);

    console.log("Fetching script...");
    const scriptRes = await fetch(manifest.scriptUrl);
    let code = await scriptRes.text();
    console.log("Script loaded, length:", code.length);

    // Eval script
    try {
        (0, eval)(code);
        console.log("Script evaluated.");
        // In Node, top-level functions attach to global
        if (global.searchResults) window.searchResults = global.searchResults;
        if (global.extractDetails) window.extractDetails = global.extractDetails;
        if (global.extractEpisodes) window.extractEpisodes = global.extractEpisodes;
        if (global.extractStreamUrl) window.extractStreamUrl = global.extractStreamUrl;
    } catch (e) {
        console.error("Eval error:", e);
        return;
    }

    // Search
    console.log("Searching for 'Naruto'...");
    const searchRes = await window.searchResults('Naruto');
    const searchData = typeof searchRes === 'string' ? JSON.parse(searchRes) : searchRes;
    console.log("Search results count:", searchData.length);
    if (searchData.length > 0) console.log("First item:", searchData[0]);

    if (searchData.length === 0) return;
    const firstItem = searchData[0];

    // Episodes
    console.log("Getting episodes...");
    const episodesRes = await window.extractEpisodes(firstItem.href);
    const episodesData = typeof episodesRes === 'string' ? JSON.parse(episodesRes) : episodesRes;

    if (episodesData.length === 0) return;
    const firstEpisode = episodesData[0];

    // Stream
    console.log("Getting stream for:", firstEpisode.href);
    try {
        const streamRes = await window.extractStreamUrl(firstEpisode.href);
        console.log("Raw stream response:", streamRes);
    } catch (e) {
        console.error("Stream extraction failed:", e);
    }
}

runTest();
