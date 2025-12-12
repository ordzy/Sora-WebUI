/**
 * Native Test Module
 * Uses the "NetworkFetch" API standard, not legacy or module object standard.
 */

// 1. Search (Global Function)
async function searchResults(query) {
    if (query === "fail") throw new Error("Search failed on purpose");

    // Test networkFetch
    const res = await networkFetch("https://jsonplaceholder.typicode.com/posts/1");
    if (!res.success) throw new Error("Network fetch failed");

    return [{
        title: "Native Test Result: " + query,
        href: "https://example.com/native-test",
        image: "https://via.placeholder.com/150",
    }];
}

// 2. Details (Global Function)
async function extractDetails(url) {
    // Test networkFetchSimple
    const res = await networkFetchSimple("https://jsonplaceholder.typicode.com/posts/1");

    return [{
        description: "This is a native module test. Status: " + (res.success ? "OK" : "FAIL"),
        title: "Native Test Title",
        aliases: "Test"
    }];
}

// 3. Episodes (Global Function)
async function extractEpisodes(url) {
    // Test aliases
    if (typeof networkFetchWithHTML !== 'function') throw new Error("Missing networkFetchWithHTML");

    return [
        { title: "Episode 1", href: "https://example.com/ep1", number: 1 },
        { title: "Episode 2", href: "https://example.com/ep2", number: 2 }
    ];
}

// 4. Stream (Global Function)
async function extractStreamUrl(url) {
    // Return structured object
    return {
        streams: [
            { label: "1080p", url: "https://test.com/1080.m3u8" },
            { label: "720p", url: "https://test.com/720.m3u8" }
        ],
        subtitles: []
    };
}
