import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { themes } from './constants/themes';
import SearchBar from './components/SearchBar';
import ContentGrid from './components/ContentGrid';
import ContentDetails from './components/ContentDetails';
import VideoPlayer from './components/VideoPlayer';
import StreamSelector from './components/StreamSelector';
import ModuleManager from './components/ModuleManager';
import AppSettings from './components/AppSettings';
import ContinueWatchingList from './components/ContinueWatchingList';
import AuthModal from './components/AuthModal';
import AccountModal from './components/AccountModal';
import { ModuleLoader } from './lib/ModuleLoader';
import { useAuth } from './contexts/AuthContext';
import { syncService } from './lib/SyncService';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
    const [view, setView] = useState('home'); // home, details, player
    const [searchTerm, setSearchTerm] = useState('');
    const [content, setContent] = useState([]);
    const [selectedContent, setSelectedContent] = useState(null);
    const [streamUrl, setStreamUrl] = useState(null);
    const [streamHeaders, setStreamHeaders] = useState(null);
    const [subtitles, setSubtitles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [availableStreams, setAvailableStreams] = useState(null);
    const [showStreamSelector, setShowStreamSelector] = useState(false);
    const [pendingEpisode, setPendingEpisode] = useState(null);
    const [pendingStreamData, setPendingStreamData] = useState(null);
    const [returnView, setReturnView] = useState('details'); // 'details' or 'home'

    // Module State (Multi-Module Support)
    const [modules, setModules] = useState([]);
    const [activeModuleId, setActiveModuleId] = useState(null);
    const [showModuleManager, setShowModuleManager] = useState(false);
    const [showAppSettings, setShowAppSettings] = useState(false);
    const [notification, setNotification] = useState(null); // { message, type: 'error'|'success' }
    const [modulesLoaded, setModulesLoaded] = useState(false); // Track if initial load is done

    // Auth State
    const { user, loading: authLoading } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced'

    // Clear notification after 3s
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const activeModule = modules.find(m => m.id === activeModuleId);

    // Initialize Theme
    useEffect(() => {
        const savedThemeId = localStorage.getItem('themeId');
        if (savedThemeId) {
            const theme = themes.find(t => t.id === savedThemeId);
            if (theme) {
                document.documentElement.style.setProperty('--color-accent', theme.colors.primary);
                document.documentElement.style.setProperty('--color-text-on-accent', theme.colors.text);
                document.documentElement.style.setProperty('--color-secondary-element', theme.colors.secondary);
            }
        }

        // Load Modules from LocalStorage
        const loadSavedModules = async () => {
            try {
                const saved = localStorage.getItem('sora_modules');
                if (saved) {
                    const savedModules = JSON.parse(saved);
                    const urls = [...new Set(savedModules.map(m => m.url))];

                    // Auto-update modules logic
                    // For now, we always reload to ensure fresh code/manifest
                    // But we could optimize based on a setting
                    const autoRefetch = localStorage.getItem('autoRefetchModules') !== 'false'; // Default true

                    const loadedModules = [];
                    for (const url of urls) {
                        try {
                            const loader = await ModuleLoader.load(url);
                            loadedModules.push({
                                id: btoa(url).replace(/[^a-zA-Z0-9]/g, ''), // Stable ID from URL (Full length to prevent collisions)
                                url,
                                name: loader.manifest?.sourceName || 'Unknown Module',
                                manifest: loader.manifest,
                                loader,
                                lastUpdated: Date.now()
                            });
                        } catch (e) {
                            console.error(`Failed to reload module ${url}`, e);
                            // Optional: show notification or keep it?
                        }
                    }

                    if (loadedModules.length > 0) {
                        setModules(loadedModules);

                        // Restore active module if possible
                        const savedActiveId = localStorage.getItem('active_module_url'); // We'll save URL as ID changes
                        if (savedActiveId) {
                            const match = loadedModules.find(m => m.url === savedActiveId);
                            if (match) setActiveModuleId(match.id);
                            else setActiveModuleId(loadedModules[0].id);
                        } else {
                            setActiveModuleId(loadedModules[0].id); // Default to first
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load saved modules", e);
            } finally {
                setModulesLoaded(true);
            }
        };

        loadSavedModules();
    }, []);

    // Sync Service Integration
    useEffect(() => {
        const initSync = async () => {
            if (user && !authLoading) {
                // Check if we've already synced this session to prevent reload loops
                const hasInitialSynced = sessionStorage.getItem('supabase_initial_sync');

                console.log('[App] User authenticated, initializing sync service');
                await syncService.init(user.id);

                // Only do initial sync once per session
                if (!hasInitialSynced) {
                    // Check if this is first login (no cloud data)
                    const cloudSettings = await syncService.getSettings();
                    if (!cloudSettings) {
                        console.log('[App] First login detected, migrating localStorage to cloud');
                        await syncService.migrateLocalStorageToCloud();
                        setNotification({ message: 'Data synced to cloud!', type: 'success' });
                        sessionStorage.setItem('supabase_initial_sync', 'true');
                    } else {
                        console.log('[App] Existing cloud data found, pulling to device');
                        await syncService.pullFromCloud();
                        setNotification({ message: 'Settings synced from cloud!', type: 'success' });

                        // Reload the page to apply synced modules and settings
                        console.log('[App] Reloading page to apply synced data...');
                        setTimeout(() => {
                            sessionStorage.setItem('supabase_initial_sync', 'true');
                            window.location.reload();
                        }, 500);
                        return; // Exit early since we're reloading
                    }
                }
            } else if (!user && !authLoading) {
                // User logged out - clear session marker
                sessionStorage.removeItem('supabase_initial_sync');
                await syncService.clear();
            }
        };

        initSync();
    }, [user, authLoading]);

    // Auto-sync every 15 seconds when authenticated
    useEffect(() => {
        if (!user) return;

        const syncAllData = async () => {
            console.log('[App] Auto-syncing data...');

            // Sync modules
            const modulesStr = localStorage.getItem('sora_modules');
            const activeModuleUrl = localStorage.getItem('active_module_url');
            if (modulesStr) {
                const modules = JSON.parse(modulesStr);
                await syncService.syncModules(modules, activeModuleUrl);
            }

            // Sync watch history
            const historyStr = localStorage.getItem('sora_watch_history');
            if (historyStr) {
                const history = JSON.parse(historyStr);
                await syncService.syncWatchHistory(history);
            }

            // Sync hidden items
            const hiddenStr = localStorage.getItem('sora_cw_hidden');
            if (hiddenStr) {
                const hidden = JSON.parse(hiddenStr);
                await syncService.syncHiddenItems(hidden);
            }

            // Sync settings
            const settings = {
                themeId: localStorage.getItem('themeId'),
                accentColor: localStorage.getItem('accentColor'),
                subSize: localStorage.getItem('subSize'),
                subColor: localStorage.getItem('subColor'),
                subBgOpacity: localStorage.getItem('subBgOpacity'),
                subOutline: localStorage.getItem('subOutline'),
                autoActivate: localStorage.getItem('autoActivate'),
                autoRefetchModules: localStorage.getItem('autoRefetchModules'),
                corsProxy: localStorage.getItem('corsProxy'),
                useCustomProxy: localStorage.getItem('useCustomProxy')
            };
            await syncService.syncSettings(settings);
        };

        // Initial sync on mount
        syncAllData();

        // Set up interval for auto-sync every 15 seconds
        const intervalId = setInterval(syncAllData, 15000);

        // Cleanup interval on unmount or when user changes
        return () => clearInterval(intervalId);
    }, [user]);

    // Save Active Module to persist selection and sync
    useEffect(() => {
        if (activeModule) {
            localStorage.setItem('active_module_url', activeModule.url);
            // Sync modules with active module info
            if (user) {
                syncService.syncModules(modules, activeModule.url);
            }
        }
    }, [activeModuleId, activeModule, user, modules]);

    // Search handler
    useEffect(() => {
        if (!activeModule) return;

        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm && activeModule.loader.search) {
                try {
                    setLoading(true);
                    const results = await activeModule.loader.search(searchTerm);
                    setContent(results);
                } catch (error) {
                    console.error('Search failed:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setContent([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, activeModuleId, activeModule]); // Include both to ensure proper re-runs


    const loadContent = async (query = '') => {
        if (!activeModule) return;
        setLoading(true);
        try {
            if (activeModule.loader.search) {
                const results = await activeModule.loader.search(query);
                setContent(results || []);
            } else {
                console.warn('Module does not implement search()');
                setContent([]);
            }
        } catch (error) {
            console.error('Failed to load content:', error);
            setContent([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectContent = async (item) => {
        setLoading(true);
        try {
            if (activeModule.loader.getDetails) {
                const details = await activeModule.loader.getDetails(item.id);
                // Merge item data (title, poster) with details to preserve search result info
                setSelectedContent({
                    ...details,
                    title: item.title || details.title,
                    name: item.title || details.name,
                    poster: item.poster || details.poster
                });
                setView('details');
            }
        } catch (error) {
            console.error('Failed to load details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleShowMediaInfo = async (historyItem) => {
        setLoading(true);
        try {
            // 1. Switch Module if needed
            // Use URL matching for robustness (ID changes on reload)
            if (historyItem.moduleUrl && (!activeModule || activeModule.url !== historyItem.moduleUrl)) {
                const moduleMatch = modules.find(m => m.url === historyItem.moduleUrl);
                if (moduleMatch) {
                    setActiveModuleId(moduleMatch.id);
                } else {
                    setNotification({ message: 'Module for this content is not loaded', type: 'error' });
                    setLoading(false);
                    return;
                }
            } else if (!historyItem.moduleUrl && historyItem.moduleId !== activeModuleId) {
                // Fallback to ID for legacy items
                const moduleExists = modules.find(m => m.id === historyItem.moduleId);
                if (moduleExists) {
                    setActiveModuleId(historyItem.moduleId);
                } else {
                    setNotification({ message: 'Module for this content is not loaded', type: 'error' });
                    setLoading(false);
                    return;
                }
            }

            // 2. Get Details
            // We rely on the newly set active module (or current one)
            // Note: setActiveModuleId is async-ish in React batching but since we check 'modules' directly below we need the object

            const targetModule = historyItem.moduleUrl
                ? modules.find(m => m.url === historyItem.moduleUrl)
                : modules.find(m => m.id === historyItem.moduleId);

            // If we just set it, targetModule is what we want.
            // If we didn't switch, activeModule might be stale in closure? 
            // Actually we just use targetModule for the loader.

            let details = {
                id: historyItem.contentId,
                title: historyItem.title,
                name: historyItem.title, // Ensure 'name' is present for ContentDetails/TMDB search
                poster: historyItem.poster,
                // Add episode info so VideoPlayer knows what to play/resume
                currentEpisode: historyItem.episodeNumber,
                resumeTimestamp: historyItem.timestamp // Pass this to detail or player?
            };

            if (targetModule && targetModule.loader.getDetails) {
                try {
                    const freshDetails = await targetModule.loader.getDetails(historyItem.contentId);

                    // CRITICAL: Validate that the fresh details actually match the history item
                    // This prevents cases where a scraper redirects to a "Home" or "Featured" page
                    // and returns details for a completely different show.

                    const cleanHistoryTitle = (historyItem.title || historyItem.name || '').toLowerCase();
                    const cleanFreshTitle = (freshDetails.title || freshDetails.name || '').toLowerCase();

                    // Simple inclusion check or strict equality if short
                    // If cleanFreshTitle is "home" or "login" or similar, reject it
                    const isSuspicious = ['home', 'login', 'featured', 'popular'].includes(cleanFreshTitle);

                    // Check for similarity (basic check: does one contain the other?)
                    const titlesMatch = cleanFreshTitle.includes(cleanHistoryTitle) || cleanHistoryTitle.includes(cleanFreshTitle);

                    if (isSuspicious) {
                        console.warn(`[Safety] Rejecting fresh details because title is suspicious: "${freshDetails.title}"`);
                        setNotification({ message: 'Could not refresh details (Invalid Source). Using saved history.', type: 'error' });
                    } else {
                        if (!titlesMatch) {
                            console.warn(`[Safety] Title mismatch detected but proceeding (History: "${historyItem.title}" vs Fresh: "${freshDetails.title}")`);
                        }
                        details = { ...details, ...freshDetails };

                        // If there was a mismatch, FORCE the history title back onto the object
                        // so that ContentDetails searches for the correct show (e.g. "One Piece")
                        // and not the generic scraper title (e.g. "Details")
                        if (!titlesMatch) {
                            console.warn(`[Safety] Restoring history title "${historyItem.title}" over mismatch "${freshDetails.title}"`);
                            details.title = historyItem.title;
                            details.name = historyItem.title;
                        }

                        // Preserve ID to prevent duplicates in history/continue watching
                        details.id = historyItem.contentId;
                    }
                } catch (e) {
                    console.warn("Could not fetch fresh details for history item", e);
                }
            }

            setSelectedContent(details);
            setView('details');

        } catch (error) {
            console.error('Failed to load content:', error);
            setNotification({ message: 'Failed to load content', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleContinueWatching = async (historyItem) => {
        // INSTANT PLAY LOGIC
        if (historyItem.streamUrl) {
            try {
                setLoading(true);

                // 1. Switch Module if needed
                if (historyItem.moduleUrl && (!activeModule || activeModule.url !== historyItem.moduleUrl)) {
                    const moduleMatch = modules.find(m => m.url === historyItem.moduleUrl);
                    if (moduleMatch) setActiveModuleId(moduleMatch.id);
                } else if (!historyItem.moduleUrl && historyItem.moduleId !== activeModuleId) {
                    const moduleExists = modules.find(m => m.id === historyItem.moduleId);
                    if (moduleExists) setActiveModuleId(historyItem.moduleId);
                }

                // 2. Set Player State
                setStreamUrl(historyItem.streamUrl);
                setStreamHeaders(historyItem.headers || {});
                setSubtitles(historyItem.subtitles || []);
                setReturnView('home'); // Go back to home when done

                // Minimal content info for player UI
                setSelectedContent({
                    id: String(historyItem.contentId),
                    title: historyItem.title,
                    currentEpisode: historyItem.episodeNumber,
                    poster: historyItem.poster,
                    resumeTimestamp: historyItem.timestamp // Pass timestamp for instant resume
                });

                setView('player'); // Go directly to player

                // Background Fetch: Load details (episodes) so the selector works
                if (activeModule && activeModule.loader.getDetails) {
                    activeModule.loader.getDetails(historyItem.contentId).then(details => {
                        setSelectedContent(prev => {
                            // Safety: Prevent scraper titles like "Details" from overwriting known good titles
                            const safeDetails = { ...details };
                            const currentTitle = prev.title || historyItem.title;

                            if (safeDetails.title && currentTitle &&
                                safeDetails.title.trim().toLowerCase() !== currentTitle.trim().toLowerCase()) {
                                // Simple heuristic: If mismatch, keep the history title (usually safer)
                                // Could be improved with Levenshtein but strict string check is safer for "Details" vs "Naruto"
                                console.warn(`[Background Fetch] Ignoring potential bad title "${safeDetails.title}", keeping "${currentTitle}"`);
                                safeDetails.title = currentTitle;
                                safeDetails.name = currentTitle; // also fix name
                            }

                            // Force ID to match history to prevent duplicates
                            safeDetails.id = prev.id;

                            return {
                                ...prev,
                                ...safeDetails,
                                episodes: details.episodes // Ensure episodes are available
                            };
                        });
                    }).catch(e => console.warn("Background details fetch failed", e));
                }

            } catch (e) {
                console.error("Instant play failed", e);
                // Fallback to details view
                handleShowMediaInfo(historyItem);
            } finally {
                setLoading(false);
            }
        } else {
            // No stream URL saved? Fallback to details
            handleShowMediaInfo(historyItem);
        }
    };


    const handlePlay = async (episode) => {
        console.log('[App] handlePlay Triggered', { episode, activeModuleId, activeModule });
        if (!activeModule) {
            console.error('[App] No active module found for playback');
            setNotification({ message: 'Playback Error: No Active Module', type: 'error' });
            return;
        }

        setLoading(true);
        setReturnView('details'); // Go back to details when done
        try {
            if (activeModule.loader.getStream) {
                const streamData = await activeModule.loader.getStream(episode.id);

                // Check if we have streams array (new format)
                if (streamData.streams && Array.isArray(streamData.streams)) {
                    if (streamData.streams.length === 0) {
                        console.error('No streams available', streamData);
                        setNotification({ message: 'No streams available for this episode.', type: 'error' });
                    } else if (streamData.streams.length === 1) {
                        // Single stream - play directly
                        const url = streamData.streams[0].url;
                        // Proxy non-HLS streams for Referer header, HLS uses custom loader
                        const proxyUrl = url.includes('.m3u8') ? url : '/api/proxy?url=' + encodeURIComponent(url);
                        setStreamUrl(proxyUrl);
                        setStreamHeaders(streamData.streams[0].headers || {});

                        // Update selected content with current episode info
                        if (selectedContent) {
                            setSelectedContent(prev => ({
                                ...prev,
                                currentEpisode: episode.number || episode.title,
                                currentEpisodeId: episode.id || episode.url, // Save ID for resume
                                resumeTimestamp: episode.resumeTimestamp // Pass resume time
                            }));
                        }
                        setSubtitles(streamData.subtitles || []);
                        setPendingStreamData(streamData);
                        setView('player');
                    } else {
                        // Multiple streams - show selector
                        setAvailableStreams(streamData.streams);
                        setPendingEpisode(episode);
                        setPendingStreamData(streamData);
                        setShowStreamSelector(true);
                    }
                } else if (streamData.url) {
                    // Legacy format - single URL
                    const url = streamData.url;
                    // Proxy non-HLS streams for Referer header, HLS uses custom loader
                    const proxyUrl = url.includes('.m3u8') ? url : '/api/proxy?url=' + encodeURIComponent(url);
                    setStreamUrl(proxyUrl);
                    setStreamHeaders(streamData.headers || {});

                    if (selectedContent) {
                        setSelectedContent(prev => ({
                            ...prev,
                            currentEpisode: episode.number || episode.title,
                            resumeTimestamp: episode.resumeTimestamp // Pass resume time
                        }));
                    }
                    setSubtitles([]);
                    setView('player');
                } else {
                    console.error('Invalid stream data', streamData);
                    setNotification({ message: 'Failed to extract stream URL.', type: 'error' });
                }
            }
        } catch (error) {
            console.error('Failed to get stream:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStreamSelect = (selectedStream) => {
        // Proxy non-HLS streams for Referer header, HLS uses custom loader
        const url = selectedStream.url;
        const proxyUrl = url.includes('.m3u8') ? url : '/api/proxy?url=' + encodeURIComponent(url);
        if (selectedContent && pendingEpisode) {
            setSelectedContent(prev => ({ ...prev, currentEpisode: pendingEpisode.number || pendingEpisode.title }));
        }
        setStreamUrl(proxyUrl);
        setStreamHeaders(selectedStream.headers || {});
        setSubtitles(pendingStreamData?.subtitles || []);
        setShowStreamSelector(false);
        setView('player');
    };

    const handleRetryStream = () => {
        // Return to stream selector or episode list
        if (availableStreams && availableStreams.length > 1) {
            setShowStreamSelector(true);
            setView('details');
        } else {
            setView('details');
        }
        setStreamUrl(null);
        setSubtitles([]);
    };

    const handleStreamSelectorClose = () => {
        setShowStreamSelector(false);
        setAvailableStreams(null);
        setPendingEpisode(null);
    };

    // Module Management Functions
    const handleAddModule = async (url) => {
        try {
            // Check for duplicate URL
            const isDuplicate = modules.some(m => m.url === url);
            if (isDuplicate) {
                console.log(`Skipping duplicate module: ${url}`);
                throw new Error(`Module already exists: ${url}`);
            }

            const id = btoa(url).replace(/[^a-zA-Z0-9]/g, ''); // Stable ID matches loadSavedModules logic
            const loader = await ModuleLoader.load(url);

            const newModule = {
                id,
                url,
                name: loader.manifest?.sourceName || 'Unknown Module',
                manifest: loader.manifest,
                loader,
                lastUpdated: Date.now()
            };

            setModules(prev => {
                const updated = [...prev, newModule];
                // Save to LocalStorage
                const minimalList = updated.map(m => ({ url: m.url, name: m.name }));
                localStorage.setItem('sora_modules', JSON.stringify(minimalList));
                return updated;
            });

            // Auto-activate logic
            const autoActivate = localStorage.getItem('autoActivate') === 'true';
            if (modules.length === 0 || autoActivate) {
                setActiveModuleId(id);
            }
        } catch (error) {
            console.error('Failed to load module:', error);
            setNotification({ message: 'Failed to load module: ' + error.message, type: 'error' });
            throw error; // Re-throw to let the caller handle it
        }
    };

    const handleDeleteModule = (moduleId) => {
        setModules(prev => {
            const updated = prev.filter(m => m.id !== moduleId);
            // Save to LocalStorage
            const minimalList = updated.map(m => ({ url: m.url, name: m.name }));
            localStorage.setItem('sora_modules', JSON.stringify(minimalList));
            return updated;
        });

        // If deleting active module, switch to first available
        if (activeModuleId === moduleId) {
            const remaining = modules.filter(m => m.id !== moduleId);
            setActiveModuleId(remaining[0]?.id || null);
            setContent([]);
            setSearchTerm('');
        }
    };

    const handleUpdateModule = async (moduleId) => {
        const module = modules.find(m => m.id === moduleId);
        if (!module) return;

        try {
            const loader = await ModuleLoader.load(module.url);

            setModules(prev => prev.map(m =>
                m.id === moduleId
                    ? { ...m, loader, manifest: loader.manifest, name: loader.manifest?.sourceName || m.name, lastUpdated: Date.now() }
                    : m
            ));
        } catch (error) {
            console.error('Failed to update module:', error);
            setNotification({ message: 'Failed to update module: ' + error.message, type: 'error' });
        }
    };

    const handleSwitchModule = (moduleId) => {
        setActiveModuleId(moduleId);
        setContent([]);
        setSearchTerm('');
        setView('home');
    };

    const handleResetModules = () => {
        setModules([]);
        setActiveModuleId(null);
        setContent([]);
        setSearchTerm('');
    };

    const loadModule = async () => {

        setSelectedContent(null);
        setView('home');
    };

    const handleBackToHome = () => {
        setSelectedContent(null);
        setView('home');
    };

    const handleLogoClick = () => {
        setView('home');
        setSelectedContent(null);
        setContent([]);
        setSearchTerm('');
    };

    const handleClosePlayer = () => {
        setStreamUrl(null);
        setView(returnView);
    };

    return (
        <div className="min-h-screen bg-background text-primary p-6 md:p-12 relative overflow-hidden">
            {/* Splash Screen */}
            <div
                className={`fixed inset-0 z-50 bg-background flex items-center justify-center transition-opacity duration-1000 ease-in-out ${modulesLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
                <div className="flex flex-col items-center animate-pulse">
                    <img src="https://files.catbox.moe/in721i.png" alt="Sora WebUI" className="w-32 h-32 md:w-48 md:h-48 object-contain mb-4" />
                </div>
            </div>

            {/* Main App Content - Fade in slightly delayed/synced */}
            <div className={`transition-opacity duration-1000 delay-500 ${modulesLoaded ? 'opacity-100' : 'opacity-0'}`}>
                {/* Module Manager */}
                {showModuleManager && (
                    <ModuleManager
                        modules={modules}
                        activeModuleId={activeModuleId}
                        onAddModule={handleAddModule}
                        onDeleteModule={handleDeleteModule}
                        onUpdateModule={handleUpdateModule}
                        onSwitchModule={handleSwitchModule}
                        onClose={() => setShowModuleManager(false)}
                    />
                )}

                {showAppSettings && (
                    <AppSettings
                        onClose={() => setShowAppSettings(false)}
                        onResetModules={handleResetModules}
                    />
                )}

                {showAuthModal && (
                    <AuthModal
                        onClose={() => setShowAuthModal(false)}
                        onAuthSuccess={() => {
                            setNotification({ message: 'Successfully logged in!', type: 'success' });
                        }}
                    />
                )}

                {showAccountModal && (
                    <AccountModal
                        onClose={() => setShowAccountModal(false)}
                    />
                )}

                {view === 'player' && streamUrl && (
                    <VideoPlayer
                        streamUrl={streamUrl}
                        headers={streamHeaders}
                        subtitles={subtitles}
                        onBack={handleClosePlayer}
                        onRetry={handleRetryStream}
                        showTitle={selectedContent?.title || selectedContent?.name || ''}
                        episodeTitle={selectedContent?.currentEpisode ? `Episode ${selectedContent.currentEpisode}` : ''}
                        contentId={String(selectedContent?.id)}
                        moduleId={String(activeModuleId)}
                        moduleName={activeModule?.name}
                        moduleUrl={activeModule?.url}
                        episodeNumber={selectedContent?.currentEpisode}
                        episodeId={selectedContent?.currentEpisodeId}
                        poster={selectedContent?.poster || selectedContent?.image}
                        initialTime={selectedContent?.resumeTimestamp || 0}
                        episodes={selectedContent?.episodes || []}
                        onPlayEpisode={handlePlay}
                        onShowInfo={() => handleShowMediaInfo({
                            contentId: selectedContent?.id,
                            moduleId: activeModuleId,
                            moduleUrl: activeModule?.url,
                            title: selectedContent?.title,
                            poster: selectedContent?.poster
                        })}
                    />
                )}

                {showStreamSelector && availableStreams && (
                    <StreamSelector
                        streams={availableStreams}
                        onSelect={handleStreamSelect}
                        onClose={handleStreamSelectorClose}
                    />
                )}

                {!showModuleManager && view !== 'player' && !showStreamSelector && (
                    <div className="max-w-7xl mx-auto">
                        {/* Hide header when on details view for immersive experience */}
                        {view !== 'details' && (
                            <>
                                {/* Header with inline search when typing/has results */}
                                {view === 'home' && activeModule && (searchTerm || content.length > 0) ? (
                                    <div className="mb-8 animate-fadeIn">
                                        <div className="flex items-center justify-between gap-4 mb-6">
                                            <div
                                                className="cursor-pointer transition-opacity hover:opacity-80 flex-shrink-0"
                                                onClick={handleLogoClick}
                                            >
                                                <img src="https://files.catbox.moe/in721i.png" alt="Sora WebUI" className="h-10 object-contain" />
                                            </div>

                                            <div className="flex-1 max-w-2xl">
                                                <SearchBar
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    autoFocus={true}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => setShowModuleManager(true)}
                                                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 font-medium hover:scale-105 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                    </svg>
                                                    Modules: {activeModule?.name || 'None'}
                                                </button>

                                                <button
                                                    onClick={() => setShowAppSettings(true)}
                                                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg text-sm transition-all duration-200 hover:scale-105"
                                                    title="Settings"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </button>

                                                {isSupabaseConfigured && (
                                                    !user ? (
                                                        <button
                                                            onClick={() => setShowAuthModal(true)}
                                                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 font-medium hover:scale-105 flex items-center gap-2"
                                                            title="Login / Sign Up"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            Login
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowAccountModal(true)}
                                                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 font-medium hover:scale-105 flex items-center gap-2"
                                                            title="Account"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {user.email?.split('@')[0]}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Header without search (for non-home views or empty state) */
                                    <div className="flex items-center justify-between mb-8 animate-fadeIn">
                                        <div
                                            className="cursor-pointer transition-opacity hover:opacity-80"
                                            onClick={handleLogoClick}
                                        >
                                            <img src="https://files.catbox.moe/in721i.png" alt="Sora WebUI" className="h-10 object-contain" />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowModuleManager(true)}
                                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 font-medium hover:scale-105 flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                                Modules: {activeModule?.name || 'None'}
                                            </button>

                                            <button
                                                onClick={() => setShowAppSettings(true)}
                                                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg text-sm transition-all duration-200 hover:scale-105"
                                                title="Settings"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </button>

                                            {isSupabaseConfigured && (
                                                !user ? (
                                                    <button
                                                        onClick={() => setShowAuthModal(true)}
                                                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 font-medium hover:scale-105 flex items-center gap-2"
                                                        title="Login / Sign Up"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        Login
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowAccountModal(true)}
                                                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 font-medium hover:scale-105 flex items-center gap-2"
                                                        title="Account"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {user.email?.split('@')[0]}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Centered search state (only when empty and no search term) */}
                        {view === 'home' && activeModule && !searchTerm && content.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
                                <svg className="w-16 h-16 mb-4 opacity-50 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <p className="text-lg text-secondary mb-8">Search something to get started...</p>
                                <div className="w-full max-w-2xl">
                                    <SearchBar
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus={true}
                                    />
                                </div>
                            </div>
                        )}

                        <main>
                            {loading && (
                                <div className="flex justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
                                </div>
                            )}

                            {!loading && !activeModule && !showModuleManager && modulesLoaded && modules.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-32 text-secondary animate-fadeIn">
                                    <svg
                                        className="w-16 h-16 mb-4 opacity-50 cursor-pointer hover:opacity-70 transition-opacity"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        onClick={() => setShowModuleManager(true)}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    <p className="text-lg">No module loaded. Click the menu to start.</p>
                                </div>
                            )}

                            {!loading && view === 'home' && activeModule && !searchTerm && (
                                <ContinueWatchingList onPlay={handleContinueWatching} onShowInfo={handleShowMediaInfo} />
                            )}

                            {!loading && view === 'home' && activeModule && content.length > 0 && (
                                <div className="animate-fadeIn">
                                    <ContentGrid content={content} onSelect={handleSelectContent} />
                                </div>
                            )}

                            {!loading && view === 'details' && selectedContent && (
                                <ContentDetails
                                    details={selectedContent}
                                    onBack={handleBackToHome}
                                    onPlay={handlePlay}
                                    activeModuleId={activeModuleId}
                                    moduleName={activeModule?.name}
                                />
                            )}
                        </main>
                    </div>
                )}

                {/* Notification Toast */}
                {notification && (
                    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] animate-slideUp">
                        <div className={`px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md border ${notification.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-200' : 'bg-surface border-white/10 text-white'}`}>
                            {notification.type === 'error' && (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <span className="text-sm font-medium">{notification.message}</span>
                        </div>
                    </div>
                )}

                <Analytics />
            </div>
        </div>
    );
};

export default App;
