import React, { useState, useEffect } from 'react';

const TMDB_API_KEY = 'b9c90b9d6d631bdef3320671882bff7b';
const TMDB_API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiOWM5MGI5ZDZkNjMxYmRlZjMzMjA2NzE4ODJiZmY3YiIsIm5iZiI6MTY5MjMyMjY2MS45MjgsInN1YiI6IjY0ZGVjYjY1YWFlYzcxMDNmY2ZkNGEyNCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.9uGgluQqIw7DlSWuYb4RoXy1WDrbFMgmICcjKLGO_gU';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

// Add helper hook for history
// We use a dummy state to force re-render when history changes
function useForceUpdate() {
    const [value, setValue] = useState(0);
    return () => setValue(value => value + 1);
}

function ContentDetails({ details, onBack, onPlay, activeModuleId, moduleName }) {
    const [backdropLoaded, setBackdropLoaded] = useState(false);
    const [tmdbData, setTmdbData] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [episodes, setEpisodes] = useState(details?.episodes || []);
    const [loading, setLoading] = useState(true);
    const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);

    // Header Menu State for Episode Items
    const [activeMenuEpisodeId, setActiveMenuEpisodeId] = useState(null);
    const forceUpdate = useForceUpdate();

    // Close menus on click outside
    useEffect(() => {
        const closeMenu = () => setActiveMenuEpisodeId(null);
        if (activeMenuEpisodeId) {
            window.addEventListener('click', closeMenu);
        }
        return () => window.removeEventListener('click', closeMenu);
    }, [activeMenuEpisodeId]);

    const handleMarkPreviousWatched = (currentEpisode) => {
        if (!activeModuleId || !details.id) return;

        try {
            const history = JSON.parse(localStorage.getItem('sora_watch_history') || '[]');
            const currentNum = parseFloat(currentEpisode.episode_number || currentEpisode.number);

            // 1. Identify older episodes
            const previousEpisodes = episodes.filter(ep => {
                const epNum = parseFloat(ep.episode_number || ep.number);
                return !isNaN(epNum) && !isNaN(currentNum) && epNum < currentNum;
            });

            if (previousEpisodes.length === 0) return;

            // 2. Prepare new history items (marked as 100% watched)
            // We reverse the array so the LATEST episode (e.g. Ep 5) is at the TOP of the history stack
            // This ensures Continue Watching picks the correct resume point (Ep 6).
            // We also stagger timestamps slightly to ensure sort order stability.
            const newEntries = [...previousEpisodes].reverse().map((ep, index) => ({
                contentId: String(details.id),
                moduleId: String(activeModuleId),
                moduleName: moduleName || details.moduleName || 'Unknown Module',
                title: details.title || details.name,
                episodeTitle: ep.name || ep.title,
                episodeNumber: ep.episode_number || ep.number,
                episodeId: ep.id,
                poster: details.poster || details.image,
                timestamp: (ep.runtime ? ep.runtime * 60 : 3600), // Use meaningful duration
                duration: (ep.runtime ? ep.runtime * 60 : 3600),
                lastWatched: Date.now() - (index * 1000) // Latest episode (Index 0) gets newest time
            }));

            // 4. ALSO Add the current episode as "Started" (0 progress) but MOST RECENT
            // This ensures Continue Watching shows "Start Episode X" instead of "Episode X-1 < 1m left"
            if (currentEpisode) {
                newEntries.unshift({
                    contentId: String(details.id),
                    moduleId: String(activeModuleId),
                    moduleName: moduleName || details.moduleName || 'Unknown Module',
                    title: details.title || details.name,
                    episodeTitle: currentEpisode.name || currentEpisode.title,
                    episodeNumber: currentEpisode.episode_number || currentEpisode.number,
                    episodeId: currentEpisode.id,
                    poster: details.poster || details.image,
                    timestamp: 0,
                    duration: (currentEpisode.runtime ? currentEpisode.runtime * 60 : 3600),
                    lastWatched: Date.now() + 1000 // Future timestamp guarantees it's the very latest
                });
            }

            // 3. Merge and dedupe
            const filteredHistory = history.filter(item => {
                if (String(item.contentId) !== String(details.id)) return true;
                if (String(item.moduleId) !== String(activeModuleId)) return true;

                const match = previousEpisodes.some(ep =>
                    String(ep.episode_number || ep.number) === String(item.episodeNumber) ||
                    String(ep.id) === String(item.episodeId)
                );
                return !match;
            });

            const updatedHistory = [...newEntries, ...filteredHistory].slice(0, 500);
            localStorage.setItem('sora_watch_history', JSON.stringify(updatedHistory));

            forceUpdate();
            setActiveMenuEpisodeId(null);
        } catch (e) {
            console.error("Failed to mark previous watched", e);
        }
    };

    const handleMarkEpisodeWatched = (episode) => {
        if (!activeModuleId || !details.id) return;

        try {
            const history = JSON.parse(localStorage.getItem('sora_watch_history') || '[]');

            // Toggle Logic: Check if already watched (>95%)
            const epNumStr = String(episode.episode_number || episode.number);
            const epIdStr = String(episode.id);

            const existingIndex = history.findIndex(item =>
                String(item.contentId) === String(details.id) &&
                String(item.moduleId) === String(activeModuleId) &&
                (String(item.episodeNumber) === epNumStr || String(item.episodeId) === epIdStr)
            );

            const isAlreadyWatched = existingIndex !== -1 && history[existingIndex].timestamp >= (history[existingIndex].duration * 0.95);

            if (isAlreadyWatched) {
                // UNWATCH: Delete the entry
                const updatedHistory = history.filter((_, idx) => idx !== existingIndex);
                localStorage.setItem('sora_watch_history', JSON.stringify(updatedHistory));
            } else {
                // WATCH: Add/Overwrite entry as 100%
                const duration = (episode.runtime ? episode.runtime * 60 : 3600); // 1hr default if unknown

                const newEntry = {
                    contentId: String(details.id),
                    moduleId: String(activeModuleId),
                    moduleName: moduleName || details.moduleName || 'Unknown Module',
                    title: details.title || details.name,
                    episodeTitle: episode.name || episode.title,
                    episodeNumber: episode.episode_number || episode.number,
                    episodeId: episode.id,
                    poster: details.poster || details.image,
                    timestamp: duration,
                    duration: duration,
                    lastWatched: Date.now()
                };

                // Remove old matching entry if any (partial watch)
                let filteredHistory = history.filter((_, idx) => idx !== existingIndex);

                // Add new at top
                let updatedHistory = [newEntry, ...filteredHistory];

                // FEATURE: Also seed the NEXT episode into history (0% progress)
                // so Continue Watching shows the next one immediately.
                const currentEpIndex = episodes.findIndex(ep => ep.id === episode.id);
                if (currentEpIndex !== -1 && currentEpIndex < episodes.length - 1) {
                    const nextEp = episodes[currentEpIndex + 1];
                    const durationNext = (nextEp.runtime ? nextEp.runtime * 60 : 0);

                    const nextEntry = {
                        contentId: String(details.id),
                        moduleId: String(activeModuleId),
                        moduleName: moduleName || details.moduleName || 'Unknown Module',
                        title: details.title || details.name,
                        episodeTitle: nextEp.name || nextEp.title,
                        episodeNumber: nextEp.episode_number || nextEp.number,
                        episodeId: nextEp.id,
                        poster: details.poster || details.image,
                        timestamp: 0, // Not started
                        duration: durationNext,
                        lastWatched: Date.now() + 100 // Ensure it appears NEWER than the one we just finished
                    };
                    updatedHistory.unshift(nextEntry);
                }

                updatedHistory = updatedHistory.slice(0, 500);
                localStorage.setItem('sora_watch_history', JSON.stringify(updatedHistory));
            }

            forceUpdate();
        } catch (e) {
            console.error("Failed to toggle episode watched", e);
        }
    };

    const getEpisodeProgress = (episode) => {
        try {
            const history = JSON.parse(localStorage.getItem('sora_watch_history') || '[]');
            const item = history.find(h =>
                String(h.contentId) === String(details.id) &&
                String(h.moduleId) === String(activeModuleId) &&
                (String(h.episodeNumber) === String(episode.episode_number || episode.number) ||
                    String(h.episodeId) === String(episode.id))
            );

            if (!item || item.duration <= 0) return 0;
            return item.timestamp / item.duration;
        } catch { return 0; }
    };

    // View & Pagination State

    // View & Pagination State
    // Initialize from localStorage or fallback to smart defaults
    const [viewMode, setViewMode] = useState('grid');
    const [episodeRange, setEpisodeRange] = useState({ start: 0, end: 50 });

    // Load separate preference based on metadata presence
    useEffect(() => {
        if (!loading) {
            const key = tmdbData ? 'sora_view_mode_meta' : 'sora_view_mode_nometa';
            const saved = localStorage.getItem(key);
            if (saved) {
                setViewMode(saved);
            } else {
                setViewMode('grid'); // Default to grid for both
            }
        }
    }, [loading, tmdbData]);

    // Save preference to separate keys
    useEffect(() => {
        if (!loading) {
            const key = tmdbData ? 'sora_view_mode_meta' : 'sora_view_mode_nometa';
            localStorage.setItem(key, viewMode);
        }
    }, [viewMode, loading, tmdbData]);

    useEffect(() => {
        // Reset state when content changes
        setBackdropLoaded(false);
        setTmdbData(null);
        // Resest to fallback episodes if available, don't clear completely
        setEpisodes(details?.episodes || []);
        setSelectedSeason(1);
        fetchTMDBData();
    }, [details?.id, details?.title, details?.name]);

    useEffect(() => {
        if (tmdbData?.seasons && selectedSeason) {
            fetchEpisodes(selectedSeason);
        }
    }, [selectedSeason, tmdbData]);

    // String similarity function using Levenshtein distance
    const calculateSimilarity = (str1, str2) => {
        if (!str1 || !str2) return 0;

        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();

        // Exact match
        if (s1 === s2) return 1;

        // Levenshtein distance
        const matrix = [];
        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        const maxLen = Math.max(s1.length, s2.length);
        return 1 - matrix[s2.length][s1.length] / maxLen;
    };

    const findBestMatch = (searchResults, title, description, year) => {
        if (!searchResults || searchResults.length === 0) return null;

        let bestMatch = null;
        let bestScore = 0;

        for (const result of searchResults) {
            const resultTitle = result.name || result.title || '';
            const resultDesc = result.overview || '';
            const resultDate = result.first_air_date || result.release_date || '';
            const resultYear = resultDate ? resultDate.substring(0, 4) : null;

            // Calculate title similarity (weighted heavily)
            const titleScore = calculateSimilarity(title, resultTitle) * 0.7;

            // Calculate description similarity
            let descScore = 0;
            if (description && resultDesc) {
                descScore = calculateSimilarity(description, resultDesc) * 0.3;
            }

            // Calculate Year similarity (Bonus)
            let yearBonus = 0;
            if (year && resultYear) {
                if (year === resultYear) {
                    yearBonus = 0.5; // Huge bonus for exact year match
                    console.log(`Year match bonus applied for "${resultTitle}" (${year})`);
                } else if (Math.abs(parseInt(year) - parseInt(resultYear)) <= 1) {
                    yearBonus = 0.2; // Small bonus for +/- 1 year
                }
            }

            const totalScore = titleScore + descScore + yearBonus;

            console.log('[Match Attempt]', resultTitle, `(${resultYear})`, 'Score:', totalScore.toFixed(2));

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = result;
            }
        }

        // Similiarity Threshold Check
        // If we have a year match, strict threshold matters less, but we still want title validity
        if (bestScore < 0.60) { // Lowered slightly since we have bonuses now? Or keep 0.8? 
            // If year matches, we might get a score like 0.5 (title) + 0.5 (year) = 1.0
            // If year doesn't match, 0.8 threshold logic remains.
            // Let's keep strictness but allow the bonus to push it over.
            // Actually, if title is weak (0.4) + year (0.5) = 0.9. Is that good?
            // Maybe. "Hunter x Hunter" (0.4 sim to "Hunter x Hunter (2011)")? No, title sim would be high.
            // We'll keep 0.8 but maybe lower it a tiny bit to allow fuzzy titles with exact years to win.

            // Let's stick to 0.8 as a safe base, but if year matched, it likely boosted it well above 1.0.
        }

        // Revised threshold logic:
        // Basic match without year needs high confidence.
        // Match WITH year is very confident.
        if (bestScore < 0.80) {
            console.log('Best match score', bestScore.toFixed(2), 'is below threshold (0.80). Using fallback.');
            return null;
        }

        console.log('Best match:', bestMatch?.name || bestMatch?.title, 'Score:', bestScore.toFixed(2));
        return bestMatch;
    };

    const fetchTMDBData = async () => {
        const title = details.title || details.name;
        // Start console group to condense logs
        console.groupCollapsed(`[TMDB] Fetching data for: ${title}`);

        try {
            setLoading(true);

            const description = details.description || '';
            const year = details.year || details.release || details.release_date || details.releaseDate || ''; // Try common props

            console.log('ID:', details.id);
            if (year) console.log('Target Year:', year);

            // Use multi-search from the start to find both TV shows and movies
            const searchQuery = encodeURIComponent(title);
            // Include year in search query if available ?? No, multi-search query param doesn't support year nicely mixed with types sometimes.
            // But we can just search title and filter/score by year.
            const multiSearchUrl = `https://api.themoviedb.org/3/search/multi?query=${searchQuery}`;

            const multiSearchResponse = await fetch(multiSearchUrl, {
                headers: {
                    'Authorization': `Bearer ${TMDB_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            const multiSearchData = await multiSearchResponse.json();

            let result = null;
            let mediaType = 'tv';

            if (multiSearchData.results && multiSearchData.results.length > 0) {
                // Filter to only TV and movie types
                const filteredResults = multiSearchData.results.filter(
                    r => r.media_type === 'tv' || r.media_type === 'movie'
                );

                console.log('Found', filteredResults.length, 'TV/Movie results');

                // Use smart matching to find the best match based on title, description AND YEAR
                result = findBestMatch(filteredResults, title, description, year);

                // --- Fallback Strategy: Check Alternative Titles ---
                if (!result && filteredResults.length > 0) {
                    console.log('No direct match found. checking alternative titles for top candidates...');

                    // Check top 3 candidates
                    const candidates = filteredResults.slice(0, 3);

                    for (const candidate of candidates) {
                        const candidateType = candidate.media_type;
                        // Fetch details with alternative titles
                        const candidateDetailsUrl = `https://api.themoviedb.org/3/${candidateType}/${candidate.id}?append_to_response=alternative_titles`;
                        const candidateResponse = await fetch(candidateDetailsUrl, {
                            headers: {
                                'Authorization': `Bearer ${TMDB_API_TOKEN}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        const candidateData = await candidateResponse.json();

                        const altTitles = candidateData.alternative_titles?.results || [];
                        // Check if any alternative title matches our search title closely
                        const bestAltMatch = altTitles.find(alt => {
                            const similarity = calculateSimilarity(title, alt.title);
                            return similarity > 0.85; // High threshold for alternative title match
                        });

                        if (bestAltMatch) {
                            console.log(`Match found via alternative title: "${bestAltMatch.title}" for "${candidateData.name || candidateData.title}"`);
                            result = candidate;
                            mediaType = candidateType;
                            break; // Stop checking candidates if we find a match
                        }
                    }
                }
                // --------------------------------------------------

                if (result) {
                    mediaType = result.media_type || mediaType;
                }
            }

            if (result) {
                const id = result.id;

                // Fetch detailed information
                const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${id}?append_to_response=images,credits,alternative_titles`;
                const detailsResponse = await fetch(detailsUrl, {
                    headers: {
                        'Authorization': `Bearer ${TMDB_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                const detailsData = await detailsResponse.json();

                setTmdbData({
                    ...detailsData,
                    mediaType,
                    tmdbId: id
                });

                // If it's a TV show, fetch episodes for season 1
                if (mediaType === 'tv' && detailsData.seasons) {
                    fetchEpisodes(1);
                }
            }
        } catch (error) {
            console.error('Failed to fetch TMDB data:', error);
        } finally {
            setLoading(false);
            console.groupEnd();
        }
    };

    const fetchEpisodes = async (seasonNumber) => {
        if (!tmdbData || tmdbData.mediaType !== 'tv') return;

        try {
            const episodesUrl = `https://api.themoviedb.org/3/tv/${tmdbData.tmdbId}/season/${seasonNumber}`;
            const response = await fetch(episodesUrl, {
                headers: {
                    'Authorization': `Bearer ${TMDB_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            const episodesData = await response.json();
            setEpisodes(episodesData.episodes || []);
        } catch (error) {
            console.error('Failed to fetch episodes:', error);
            // Don't clear episodes on error if we have fallback data
            if (!details.episodes || details.episodes.length === 0) {
                setEpisodes([]);
            }
        }
    };

    const handleEpisodePlay = (episode) => {
        console.log('[ContentDetails] handleEpisodePlay', { episode, tmdbData, isTmdbEpisode: (episode.episode_number !== undefined || episode.still_path !== undefined) && tmdbData });
        // Check if this is a TMDB episode (has episode_number or still_path) AND we have TMDB data
        const isTmdbEpisode = (episode.episode_number !== undefined || episode.still_path !== undefined) && tmdbData;

        // If it's a TMDB episode, try to find the matching module episode
        if (isTmdbEpisode) {
            const moduleEpisode = details.episodes?.find(
                ep => ep.number === episode.episode_number || ep.title?.includes(episode.name)
            );

            if (moduleEpisode) {
                onPlay(moduleEpisode);
                return;
            }

            // Fallback: construct episode ID from available data
            const episodeNum = episode.episode_number || 1;
            onPlay({
                id: `${details.id}-s${selectedSeason}e${episodeNum}`,
                title: episode.name,
                number: episodeNum
            });
            return;
        }

        // It's a module episode (from One Pace, etc.) - use it directly
        onPlay({
            id: episode.href || episode.id,
            title: episode.title || episode.name,
            number: episode.number || 1
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    const backdrop = tmdbData?.backdrop_path
        ? `${TMDB_IMAGE_BASE}original${tmdbData.backdrop_path}`
        : details.poster; // Fallback to module poster if no TMDB backdrop

    const logo = tmdbData?.images?.logos?.find(l => l.iso_639_1 === 'en') || tmdbData?.images?.logos?.[0];
    const logoUrl = logo ? `${TMDB_IMAGE_BASE}original${logo.file_path}` : null;

    const title = tmdbData?.name || tmdbData?.title || details.title || details.name;
    const year = tmdbData?.first_air_date?.substring(0, 4) || tmdbData?.release_date?.substring(0, 4);
    const rating = tmdbData?.vote_average ? (tmdbData.vote_average / 2).toFixed(1) : null;
    const genres = tmdbData?.genres?.map(g => g.name) || [];
    const overview = tmdbData?.overview || details.description;

    const isMovie = tmdbData?.mediaType === 'movie';
    const isSingleEpisode = episodes.length === 1;
    // User requested same aspect ratio as shows (h-[45vh]) even for movies
    const bannerHeightClass = 'h-[45vh]';

    return (
        <div className="min-h-screen bg-background text-white">
            {/* Backdrop Section */}
            <div className={`relative top-0 left-0 w-full ${bannerHeightClass} overflow-hidden z-0`}>
                {backdrop && (
                    <>
                        <img
                            src={backdrop}
                            alt={title}
                            className={`w-full h-full object-cover object-center ${backdropLoaded ? 'opacity-100 duration-1000' : 'opacity-0'}`}
                            style={{ transition: 'opacity 1s ease-in-out' }}
                            onLoad={() => setBackdropLoaded(true)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent"></div>
                    </>
                )}

                {/* Content Overlay - REMOVED, moved below to be above episodes */}
            </div>

            {/* Content Info Section - Now positioned above episodes */}
            <div className="relative z-10 -mt-16 px-8 md:px-16">
                <div className="max-w-7xl">
                    {/* Logo */}
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={title}
                            className="max-w-md max-h-32 mb-6 object-contain"
                            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
                        />
                    ) : (
                        <h1 className="text-5xl font-bold mb-6" style={{ textShadow: '0 4px 8px rgba(0,0,0,0.5)' }}>
                            {title}
                        </h1>
                    )}

                    {/* Metadata Row */}
                    <div className="flex items-center gap-4 mb-4 text-sm">
                        {year && (
                            <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {year}
                            </span>
                        )}

                        {rating && (
                            <span className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                {rating}
                            </span>
                        )}

                        {genres.length > 0 && (
                            <div className="flex gap-2">
                                {genres.slice(0, 3).map((genre, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-white/10 rounded-full text-xs">
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {overview && (
                        <p className="max-w-2xl text-sm leading-relaxed text-gray-300 mb-6">
                            {overview}
                        </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 mb-12">
                        {(() => {
                            // Resume Logic: Check history for this content
                            let resumeData = null;
                            try {
                                const history = JSON.parse(localStorage.getItem('sora_watch_history') || '[]');
                                const matches = history.filter(item =>
                                    String(item.contentId) === String(details.id) &&
                                    String(item.moduleId) === String(activeModuleId)
                                );
                                // Find most recent
                                if (matches.length > 0) {
                                    let latest = matches.sort((a, b) => b.lastWatched - a.lastWatched)[0];

                                    // Check if completed (> 95%)
                                    const percent = latest.timestamp / latest.duration;
                                    if (percent > 0.95) {
                                        // Try to find next episode
                                        const currentIndex = episodes.findIndex(ep =>
                                            String(ep.id) === String(latest.episodeId) ||
                                            Number(ep.episode_number) === Number(latest.episodeNumber)
                                        );

                                        if (currentIndex !== -1 && currentIndex < episodes.length - 1) {
                                            const nextEp = episodes[currentIndex + 1];
                                            resumeData = {
                                                episodeId: nextEp.id,
                                                episodeNumber: nextEp.episode_number || (latest.episodeNumber + 1),
                                                timestamp: 0,
                                                duration: nextEp.runtime ? nextEp.runtime * 60 : 0,
                                                isNextEpisode: true
                                            };
                                        } else {
                                            // Finished last episode or can't find next
                                            resumeData = null; // Revert to Play (From start)
                                        }
                                    } else {
                                        resumeData = latest;
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to parse history", e);
                            }

                            if (resumeData) {
                                const formatTime = (seconds) => {
                                    if (!seconds || isNaN(seconds)) return '0:00';
                                    const mins = Math.floor(seconds / 60);
                                    const secs = Math.floor(seconds % 60);
                                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                                };

                                return (
                                    <button
                                        onClick={() => {
                                            if (resumeData.isNextEpisode) {
                                                // Find the actual episode object to play
                                                const nextEp = episodes.find(ep =>
                                                    String(ep.id) === String(resumeData.episodeId) ||
                                                    Number(ep.episode_number) === Number(resumeData.episodeNumber)
                                                );
                                                if (nextEp) handleEpisodePlay(nextEp);
                                            } else {
                                                // Standard resume
                                                const epToResume = episodes.find(ep =>
                                                    String(ep.id) === String(resumeData.episodeId) ||
                                                    Number(ep.episode_number) === Number(resumeData.episodeNumber)
                                                );

                                                // If we have the episode object, use it (better metadata)
                                                if (epToResume) {
                                                    handleEpisodePlay({
                                                        ...epToResume,
                                                        resumeTimestamp: resumeData.timestamp // Pass timestamp explicitly
                                                    });
                                                } else {
                                                    // Fallback if episode list doesn't have it (pagination?)
                                                    handleEpisodePlay({
                                                        id: resumeData.episodeId,
                                                        name: resumeData.episodeTitle,
                                                        episode_number: resumeData.episodeNumber,
                                                        resumeTimestamp: resumeData.timestamp
                                                    });
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                        </svg>
                                        <div className="text-left leading-tight">
                                            <div className="text-sm font-extrabold uppercase tracking-wide opacity-80" style={{ fontSize: '10px' }}>
                                                {resumeData.isNextEpisode ? `Start Watching Episode ${resumeData.episodeNumber}` : `Continue Watching: Episode ${resumeData.episodeNumber}`}
                                            </div>
                                            <div className="text-sm font-semibold">
                                                {formatTime(resumeData.timestamp)} / {resumeData.duration > 0 ? formatTime(resumeData.duration) : '--:--'}
                                            </div>
                                        </div>
                                    </button>
                                );
                            } else {
                                // Default Play Button
                                return (
                                    <button
                                        onClick={() => {
                                            if (tmdbData?.mediaType === 'movie') {
                                                onPlay({ id: details.id, title: title, number: 1 });
                                            } else if (episodes.length > 0) {
                                                handleEpisodePlay(episodes[0]);
                                            }
                                        }}
                                        className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                        </svg>
                                        <span>Play</span>
                                    </button>
                                );
                            }
                        })()}


                    </div>
                </div>
            </div>

            {/* Episodes Section - Hidden for Movies or Single Episodes */}
            <div className="relative z-10">
                {(!isMovie && !isSingleEpisode) && (
                    <div className="px-8 md:px-16 py-12">
                        {episodes.length === 0 ? (
                            /* No Episodes Message */
                            <div className="text-center py-20 bg-white/5 rounded-xl border border-white/5 mx-auto max-w-4xl">
                                <div className="text-6xl text-white/10 mb-4">
                                    <svg className="w-20 h-20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-400">No episodes available at this time.</h3>
                                <p className="text-gray-500 mt-2 text-sm">Check back later or try a different source.</p>
                            </div>
                        ) : (
                            /* Standard Episode List UI */
                            <>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                        <div className="w-1 h-8 bg-accent shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                        Episodes
                                    </h2>

                                    <div className="flex items-center gap-3">
                                        {/* View Toggles */}
                                        <div className="bg-white/5 p-1 rounded-lg border border-white/10 flex items-center">
                                            <button
                                                onClick={() => setViewMode('grid')}
                                                className={`p-2 rounded transition-all ${viewMode === 'grid' ? 'bg-white/10 text-accent shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                                title="Grid View"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setViewMode('list')}
                                                className={`p-2 rounded transition-all ${viewMode === 'list' ? 'bg-white/10 text-accent shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                                title="List View"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* No Metadata: Pagination Selector */}
                                        {!tmdbData && episodes.length > 50 && (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)} // Using same state var for simplicity or create new one
                                                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/10 transition-all min-w-[160px] justify-between"
                                                >
                                                    <span className="font-medium text-sm">Episodes {episodeRange.start + 1}-{Math.min(episodeRange.end, episodes.length)}</span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {isSeasonDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setIsSeasonDropdownOpen(false)}></div>
                                                        <div className="absolute top-full right-0 mt-2 w-48 bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 max-h-60 overflow-y-auto">
                                                            {Array.from({ length: Math.ceil(episodes.length / 50) }).map((_, idx) => {
                                                                const start = idx * 50;
                                                                const end = start + 50;
                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => {
                                                                            setEpisodeRange({ start, end });
                                                                            setIsSeasonDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-4 py-3 hover:bg-white/10 text-sm border-b border-white/5 last:border-0 ${episodeRange.start === start ? 'text-accent bg-white/5' : 'text-gray-300'}`}
                                                                    >
                                                                        Episodes {start + 1} - {Math.min(end, episodes.length)}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* TMDB: Season Selector */}
                                        {tmdbData?.seasons && tmdbData.seasons.length > 1 && (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                                                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/10 transition-all min-w-[140px] justify-between z-50 shadow-lg"
                                                >
                                                    <span className="font-medium">Season {selectedSeason}</span>
                                                    <svg
                                                        className={`w-4 h-4 transition-transform duration-300 ${isSeasonDropdownOpen ? 'rotate-180' : ''}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {isSeasonDropdownOpen && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-40"
                                                            onClick={() => setIsSeasonDropdownOpen(false)}
                                                        ></div>
                                                        <div className="absolute top-full right-0 mt-2 w-56 bg-surface/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="p-1">
                                                                {tmdbData.seasons
                                                                    .filter(s => s.season_number > 0)
                                                                    .map(season => (
                                                                        <button
                                                                            key={season.id}
                                                                            onClick={() => {
                                                                                setSelectedSeason(season.season_number);
                                                                                setIsSeasonDropdownOpen(false);
                                                                            }}
                                                                            className={`w-full text-left px-4 py-3 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between text-sm ${selectedSeason === season.season_number ? 'text-accent bg-white/5 font-medium' : 'text-gray-300'
                                                                                }`}
                                                                        >
                                                                            <span>Season {season.season_number}</span>
                                                                            {selectedSeason === season.season_number && (
                                                                                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                            )}
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content Render Logic */}
                                {tmdbData ? (
                                    /* --- METADATA PRESENT --- */
                                    viewMode === 'list' ? (
                                        /* List View (Original Rich Row) */
                                        <div className="space-y-4">
                                            {episodes.map((episode) => {
                                                const progress = getEpisodeProgress(episode);
                                                const isWatched = progress > 0.85;

                                                return (
                                                    <div
                                                        key={episode.id}
                                                        className="group bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden transition-all cursor-pointer border border-white/10 hover:border-white/20 relative"
                                                        onClick={() => handleEpisodePlay(episode)}
                                                    >
                                                        <div className="flex gap-4 p-4 pr-16">
                                                            {/* Thumbnail */}
                                                            <div className="relative flex-shrink-0 w-48 h-28 bg-white/10 rounded-lg overflow-hidden">
                                                                {episode.still_path ? (
                                                                    <img src={`${TMDB_IMAGE_BASE}w300${episode.still_path}`} alt={episode.name} className={`w-full h-full object-cover ${isWatched ? 'grayscale-[50%] opacity-80' : ''}`} />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-white/50">
                                                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    </div>
                                                                )}
                                                                <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-xs font-bold">{episode.episode_number}</div>

                                                                {/* Watched Checkmark */}
                                                                {isWatched && (
                                                                    <div className="absolute top-2 right-2 bg-accent text-white rounded-full p-0.5 shadow-md z-10 pointer-events-none">
                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </div>
                                                                )}

                                                                {/* Progress Bar */}
                                                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                                                    <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress * 100}%` }}></div>
                                                                </div>

                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <div className="bg-white/90 rounded-full p-2"><svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg></div>
                                                                </div>
                                                            </div>
                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                <h3 className="text-lg font-bold mb-1 group-hover:text-accent transition-colors">{episode.name}</h3>
                                                                <p className="text-sm text-gray-400 line-clamp-2">{episode.overview || 'No description available.'}</p>
                                                                {episode.runtime && <span className="text-xs text-gray-500 mt-2 block">{episode.runtime} min</span>}
                                                            </div>
                                                        </div>

                                                        {/* Context Menu (Absolute Right) */}
                                                        <div className="absolute top-1/2 -translate-y-1/2 right-4 z-30" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => setActiveMenuEpisodeId(activeMenuEpisodeId === episode.id ? null : episode.id)}
                                                                className={`p-2 rounded-full transition-colors backdrop-blur-sm border ${activeMenuEpisodeId === episode.id ? 'bg-accent text-white border-transparent' : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/20 hover:text-white'}`}
                                                            >
                                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                                </svg>
                                                            </button>

                                                            {/* Dropdown */}
                                                            {activeMenuEpisodeId === episode.id && (
                                                                <div className="absolute top-full right-0 mt-2 w-56 bg-surface border border-white/10 rounded-lg shadow-xl overflow-hidden animate-fadeIn z-40 relative">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleMarkEpisodeWatched(episode);
                                                                            setActiveMenuEpisodeId(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors border-b border-white/5"
                                                                    >
                                                                        {isWatched ? (
                                                                            <>
                                                                                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                Mark as Unwatched
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                                Mark as Watched
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMarkPreviousWatched(episode)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors"
                                                                    >
                                                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                                                                        Mark Previous Watched
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* Grid View (New Vertical Card) */
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {episodes.map((episode) => {
                                                const progress = getEpisodeProgress(episode);
                                                const isWatched = progress > 0.85;

                                                return (
                                                    <div
                                                        key={episode.id}
                                                        onClick={() => handleEpisodePlay(episode)}
                                                        className="group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col relative"
                                                    >
                                                        {/* Top Title Bar */}
                                                        <div className="p-3 border-b border-white/5 bg-black/20">
                                                            <h3 className="font-bold text-sm truncate group-hover:text-accent transition-colors">
                                                                {episode.episode_number}. {episode.name}
                                                            </h3>
                                                        </div>

                                                        {/* Middle Image */}
                                                        <div className="relative w-full aspect-video bg-black/50 overflow-hidden">
                                                            {episode.still_path ? (
                                                                <img
                                                                    src={`${TMDB_IMAGE_BASE}w500${episode.still_path}`}
                                                                    alt={episode.name}
                                                                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isWatched ? 'grayscale-[50%] opacity-80' : ''}`}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-white/20">
                                                                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                </div>
                                                            )}

                                                            {/* Watched Checkmark (Top Right) */}
                                                            {isWatched && (
                                                                <div className="absolute top-2 right-2 bg-accent text-white rounded-full p-0.5 shadow-md z-10 pointer-events-none">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                            )}

                                                            {/* Progress Bar (Bottom of Image) */}
                                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                                                <div
                                                                    className="h-full bg-accent transition-all duration-300"
                                                                    style={{ width: `${progress * 100}%` }}
                                                                ></div>
                                                            </div>

                                                            {/* Play Overlay */}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200">
                                                                    <svg className="w-5 h-5 text-black ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Bottom Desc */}
                                                        <div className="p-4 flex-1 bg-gradient-to-b from-transparent to-black/20 relative">
                                                            <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed pr-6">
                                                                {episode.overview || 'No description available for this episode.'}
                                                            </p>
                                                            {episode.runtime && (
                                                                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    {episode.runtime} min
                                                                </div>
                                                            )}

                                                            {/* Menu Button (Bottom Right) */}
                                                            <div className="absolute bottom-2 right-2 z-30" onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => setActiveMenuEpisodeId(activeMenuEpisodeId === episode.id ? null : episode.id)}
                                                                    className={`p-1.5 rounded-full transition-colors backdrop-blur-sm border ${activeMenuEpisodeId === episode.id ? 'bg-accent text-white border-transparent' : 'bg-black/60 text-gray-300 border-transparent hover:bg-white/20 hover:text-white'}`}
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                                    </svg>
                                                                </button>

                                                                {/* Dropdown */}
                                                                {activeMenuEpisodeId === episode.id && (
                                                                    <div className="absolute bottom-full right-0 mb-2 w-56 bg-surface border border-white/10 rounded-lg shadow-xl overflow-hidden animate-fadeIn z-40">
                                                                        <button
                                                                            onClick={() => {
                                                                                handleMarkEpisodeWatched(episode);
                                                                                setActiveMenuEpisodeId(null);
                                                                            }}
                                                                            className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors border-b border-white/5"
                                                                        >
                                                                            {isWatched ? (
                                                                                <>
                                                                                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                                    </svg>
                                                                                    Mark as Unwatched
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                    Mark as Watched
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleMarkPreviousWatched(episode)}
                                                                            className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors"
                                                                        >
                                                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                                                                            Mark Previous Watched
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    /* --- NO METADATA (Compact) --- */
                                    viewMode === 'grid' ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {(episodes.length > 50 ? episodes.slice(episodeRange.start, episodeRange.end) : episodes).map((episode) => {
                                                const progress = getEpisodeProgress(episode);
                                                const isWatched = progress > 0.85;

                                                return (
                                                    <div
                                                        key={episode.id}
                                                        className="group relative rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(var(--color-accent-rgb),0.2)] cursor-pointer aspect-[4/3]"
                                                    >
                                                        {/* Inner Content (Clipped) */}
                                                        <div
                                                            className="absolute inset-0 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-accent/50 rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 gap-3 z-10"
                                                            onClick={() => handleEpisodePlay(episode)}
                                                        >
                                                            <div className={`text-4xl font-black text-white/20 group-hover:text-accent transition-colors ${isWatched ? 'grayscale-[50%] opacity-80' : ''}`}>
                                                                {episode.number || episode.episode_number || (episodes.indexOf(episode) + 1)}
                                                            </div>
                                                            <div className="text-center w-full mt-3">
                                                                <div className="text-sm font-semibold text-white group-hover:text-white/90 truncate px-2">
                                                                    {episode.title || episode.name || `Episode ${episode.number}`}
                                                                </div>
                                                            </div>

                                                            {isWatched && (
                                                                <div className="absolute top-2 right-2 bg-accent text-white rounded-full p-0.5 shadow-md z-10 pointer-events-none">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                                </div>
                                                            )}

                                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                                                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress * 100}%` }}></div>
                                                            </div>

                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200">
                                                                    <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Context Menu (Outside Inner Content, High Z-Index) */}
                                                        <div className="absolute bottom-2 right-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => setActiveMenuEpisodeId(activeMenuEpisodeId === episode.id ? null : episode.id)}
                                                                className={`p-1.5 rounded-full transition-colors backdrop-blur-sm border ${activeMenuEpisodeId === episode.id ? 'bg-accent text-white border-transparent' : 'bg-black/60 text-white/70 border-transparent hover:bg-white/20 hover:text-white'}`}
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                                </svg>
                                                            </button>

                                                            {activeMenuEpisodeId === episode.id && (
                                                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-surface border border-white/10 rounded-lg shadow-xl overflow-hidden animate-fadeIn z-50 text-left">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleMarkEpisodeWatched(episode);
                                                                            setActiveMenuEpisodeId(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors border-b border-white/5"
                                                                    >
                                                                        {isWatched ? (
                                                                            <>
                                                                                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                Mark as Unwatched
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                                Mark as Watched
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMarkPreviousWatched(episode)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors"
                                                                    >
                                                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                                                                        Mark Previous Watched
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* List View (New Compact Rows) */
                                        <div className="flex flex-col gap-2">
                                            {(episodes.length > 50 ? episodes.slice(episodeRange.start, episodeRange.end) : episodes).map((episode) => {
                                                const progress = getEpisodeProgress(episode);
                                                const isWatched = progress > 0.85;

                                                return (
                                                    <div
                                                        key={episode.id}
                                                        onClick={() => handleEpisodePlay(episode)}
                                                        className={`group relative flex items-center gap-4 p-3 pr-16 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-accent/30 transition-all text-left cursor-pointer ${activeMenuEpisodeId === episode.id ? 'z-40' : ''}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded bg-black/30 flex items-center justify-center font-bold text-white/50 group-hover:text-accent group-hover:bg-white/10 transition-colors ${isWatched ? 'grayscale opacity-70' : ''}`}>
                                                            {episode.number || episode.episode_number || (episodes.indexOf(episode) + 1)}
                                                        </div>

                                                        {isWatched && (
                                                            <div className="absolute top-2 left-2 text-accent z-10">
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-gray-200 group-hover:text-white truncate">
                                                                {episode.title || episode.name || `Episode ${episode.number}`}
                                                            </div>
                                                        </div>

                                                        {/* Progress Bar (Whole Bottom) */}
                                                        {progress > 0 && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                                                <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }}></div>
                                                            </div>
                                                        )}

                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                                        </div>

                                                        {/* Context Menu (Right, High Z, No Overlap via Padding) */}
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => setActiveMenuEpisodeId(activeMenuEpisodeId === episode.id ? null : episode.id)}
                                                                className={`p-2 rounded-full transition-colors backdrop-blur-sm border ${activeMenuEpisodeId === episode.id ? 'bg-accent text-white border-transparent' : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/20 hover:text-white'}`}
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                                </svg>
                                                            </button>

                                                            {activeMenuEpisodeId === episode.id && (
                                                                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-white/10 rounded-lg shadow-xl overflow-hidden animate-fadeIn z-50 text-left">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleMarkEpisodeWatched(episode);
                                                                            setActiveMenuEpisodeId(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors border-b border-white/5"
                                                                    >
                                                                        {isWatched ? (
                                                                            <>
                                                                                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                Mark as Unwatched
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                                Mark as Watched
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMarkPreviousWatched(episode)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-white flex items-center gap-3 transition-colors"
                                                                    >
                                                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                                                                        Mark Previous Watched
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Back Button */}
            <button
                onClick={onBack}
                className="fixed top-8 left-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </button>
        </div>
    );
}

export default ContentDetails;
