import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const VideoPlayer = ({ streamUrl, headers, subtitles = [], onBack, onRetry, episodeTitle = '', showTitle = '', contentId, moduleId, moduleName, moduleUrl, episodeNumber, episodeId, poster, initialTime = 0, episodes = [], onPlayEpisode, onShowInfo }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const hlsRef = useRef(null);
    const recoveryAttemptsRef = useRef(0);
    const loadTimeoutRef = useRef(null);
    const progressBarRef = useRef(null);
    const hasInitializedTime = useRef(false); // Track if we've set initial time for this stream

    // Reset init flag when stream changes
    useEffect(() => {
        hasInitializedTime.current = false;
    }, [streamUrl]);

    // Note: We removed the separate useEffect for initialTime.
    // Instead, we handle it inside the 'resumePlayback' function on loadedmetadata event
    // to ensure it conflicts/cooperates correctly with localStorage resume.

    const [error, setError] = useState(null);
    const [playing, setPlaying] = useState(true); // Auto-play by default
    const [buffering, setBuffering] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState([]); // New buffered state
    const [showControls, setShowControls] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsSubMenu, setSettingsSubMenu] = useState(null); // null (main), 'speed', 'quality'
    const [playbackRate, setPlaybackRate] = useState(1);
    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1);
    const [showSubtitles, setShowSubtitles] = useState(true);

    // Refs for interaction logic
    const controlsTimeoutRef = useRef(null);
    const spacebarHeldRef = useRef(false);
    const spacebarTimerRef = useRef(null); // Timer for hold detection
    const originalPlaybackRateRef = useRef(1);
    const [is2xSpeed, setIs2xSpeed] = useState(false);

    // Subtitle Style State
    const [subSettings, setSubSettings] = useState({
        size: localStorage.getItem('subSize') || '100%',
        color: localStorage.getItem('subColor') || '#ffffff',
        bgOpacity: localStorage.getItem('subBgOpacity') || '0.5',
        outline: localStorage.getItem('subOutline') || 'none',
    });
    const [showCaptionMenu, setShowCaptionMenu] = useState(false);
    const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverPosition, setHoverPosition] = useState(null);
    const [openDropdown, setOpenDropdown] = useState(null); // 'bg' or 'outline' elsewhere if needed, but for player menu we might use simple list

    // Inject subtitle styles
    useEffect(() => {
        const styleId = 'sora-subtitle-styles';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        // Font size calculation: standard is roughly 5vh or 24px, we scale it
        // We use !important to override browser defaults if needed
        styleEl.innerHTML = `
            video::cue {
                font-size: ${subSettings.size} !important;
                color: ${subSettings.color} !important;
                background-color: rgba(0,0,0,${subSettings.bgOpacity}) !important;
                text-shadow: ${subSettings.outline === 'outline' ? '0px 0px 6px #000, 0px 0px 8px #000' : 'none'} !important;
            }
            /* Webkit specific for some browsers */
            video::-webkit-media-text-track-display {
                font-size: ${subSettings.size};
            }
        `;

        return () => {
            // Optional: cleanup, but we might want persistence across navigations
        };
    }, [subSettings]);

    const handleSubSettingChange = (key, value) => {
        const newSettings = { ...subSettings, [key]: value };
        setSubSettings(newSettings);
        localStorage.setItem(key === 'bgOpacity' ? 'subBgOpacity' : `sub${key.charAt(0).toUpperCase() + key.slice(1)}`, value);
    };

    // Format time as MM:SS
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Auto-hide controls
    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        if (playing && !showSettings) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    };

    const [isReady, setIsReady] = useState(false); // Delay start until UI/Episodes stabilize

    // Wait for Episodes or Timeout before starting playback
    useEffect(() => {
        // If we already have episodes, or if we've waited long enough (fallback), start.
        if (episodes.length > 0) {
            setIsReady(true);
            return;
        }

        // Fallback: If no episodes load within 1s (e.g. Movie or Network lag), proceed anyway
        // This prevents hanging forever on movies.
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 800); // 800ms delay to allow UI to settle

        return () => clearTimeout(timer);
    }, [episodes]);

    useEffect(() => {
        if (!isReady) return; // Don't init video until ready

        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleDurationChange = () => setDuration(video.duration);
        const handlePlay = () => setPlaying(true);
        const handlePause = () => setPlaying(false);
        const handleVolumeChange = () => {
            setVolume(video.volume);
            setMuted(video.muted);
        };
        const handleWaiting = () => setBuffering(true);
        const handleCanPlay = () => setBuffering(false);
        const handlePlaying = () => setBuffering(false);
        const handleProgress = () => { // Update buffered ranges
            const ranges = [];
            for (let i = 0; i < video.buffered.length; i++) {
                ranges.push({
                    start: video.buffered.start(i),
                    end: video.buffered.end(i)
                });
            }
            setBuffered(ranges);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('progress', handleProgress);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('progress', handleProgress);
        };
    }, [isReady]); // Depend on isReady to attach listeners only when playing starts

    // Progress Saving Logic
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !contentId || !moduleId) return;

        const saveProgress = () => {
            if (video.currentTime > 2 && video.duration > 0) { // Only save if watched > 2s
                const historyItem = {
                    contentId,
                    moduleId,
                    moduleName,
                    moduleUrl,
                    title: showTitle,
                    episodeTitle,
                    episodeNumber,
                    episodeId,
                    poster,
                    streamUrl,
                    headers,
                    subtitles,
                    timestamp: video.currentTime,
                    duration: video.duration,
                    lastWatched: Date.now()
                };

                try {
                    const existingHistory = JSON.parse(localStorage.getItem('sora_watch_history') || '[]');
                    // Remove existing entry for this content/module/episode combo if exists
                    const filteredHistory = existingHistory.filter(item => {
                        const isSameContent = String(item.contentId) === String(contentId);
                        if (!isSameContent) return true; // Keep different content

                        const isSameModuleId = String(item.moduleId) === String(moduleId);

                        // We want to replace ANY entry for this Content+Module with the latest status.
                        // This prevents "Continue Watching" from showing multiple episodes for the same show.
                        if (isSameModuleId || (item.moduleUrl && moduleUrl && item.moduleUrl === moduleUrl)) {
                            return false; // Remove old entry (regardless of episode) so we can add the new one
                        }

                        return true;
                    });

                    // Add new entry to top
                    const newHistory = [historyItem, ...filteredHistory].slice(0, 500); // Increased limit
                    localStorage.setItem('sora_watch_history', JSON.stringify(newHistory));

                    // UN-HIDE if previously hidden
                    const key = `${contentId}-${moduleId}`;
                    const savedHidden = localStorage.getItem('sora_cw_hidden');
                    if (savedHidden && savedHidden.includes(key)) {
                        const hiddenIds = JSON.parse(savedHidden);
                        const newHidden = hiddenIds.filter(id => id !== key);
                        localStorage.setItem('sora_cw_hidden', JSON.stringify(newHidden));
                    }

                    // FEATURE: Auto-seed NEXT episode if current is > 95% finished
                    if (video.currentTime >= (video.duration * 0.95)) {
                        const currentEpIndex = episodes.findIndex(ep =>
                            String(ep.id) === String(episodeId) ||
                            Number(ep.episode_number) === Number(episodeNumber)
                        );

                        if (currentEpIndex !== -1 && currentEpIndex < episodes.length - 1) {
                            const nextEp = episodes[currentEpIndex + 1];

                            // Check if we already have a newer entry for the next episode to avoid overwriting
                            const hasNewerNext = newHistory.some(h =>
                                String(h.episodeId) === String(nextEp.id) &&
                                h.lastWatched > Date.now()
                            );

                            if (!hasNewerNext) {
                                const durationNext = (nextEp.runtime ? nextEp.runtime * 60 : 0);
                                const nextEntry = {
                                    contentId: String(contentId),
                                    moduleId: String(moduleId),
                                    moduleName: moduleName,
                                    title: showTitle,
                                    episodeTitle: nextEp.name || nextEp.title,
                                    episodeNumber: nextEp.episode_number || nextEp.number,
                                    episodeId: nextEp.id,
                                    poster: poster,
                                    timestamp: 0,
                                    duration: durationNext,
                                    lastWatched: Date.now() + 100 // Ensure it stays on top of the current one
                                };

                                // Add next entry to top (might duplicate if we don't filter, but deduper handles display)
                                // To keep storage clean, let's filter nextEp out first too
                                const uniqueHistory = newHistory.filter(h => String(h.episodeId) !== String(nextEp.id));
                                uniqueHistory.unshift(nextEntry);

                                localStorage.setItem('sora_watch_history', JSON.stringify(uniqueHistory.slice(0, 500)));
                            }
                        }
                    }

                } catch (e) {
                    console.error("Failed to save watch history", e);
                }
            }
        };

        // Save every 10 seconds
        const intervalId = setInterval(saveProgress, 10000);

        // Save on pause and unload
        video.addEventListener('pause', saveProgress);
        window.addEventListener('beforeunload', saveProgress);

        // Resume logic - check history on mount
        const resumePlayback = () => {
            // Priority 1: Explicit initialTime passed from props (e.g. Resume button)
            if (initialTime > 0 && !hasInitializedTime.current) {
                if (video.currentTime < 5) {
                    video.currentTime = initialTime;
                    console.log(`[VideoPlayer] Resumed from initialTime prop: ${initialTime}`);
                    hasInitializedTime.current = true;
                    return; // Skip local storage check
                }
            }

            try {
                const history = JSON.parse(localStorage.getItem('sora_watch_history') || '[]');
                const savedItem = history.find(item =>
                    item.contentId === contentId &&
                    item.moduleId === moduleId &&
                    item.episodeNumber === episodeNumber
                );

                // Priority 2: Use local storage history
                if (savedItem && savedItem.timestamp > 0 && savedItem.timestamp < (savedItem.duration * 0.95)) {
                    // Only auto-seek if we are just starting (currentTime < 5)
                    if (video.currentTime < 5 && !hasInitializedTime.current) {
                        video.currentTime = savedItem.timestamp;
                        console.log(`[VideoPlayer] Resumed from saved history: ${savedItem.timestamp}`);
                        hasInitializedTime.current = true;
                    }
                }
            } catch (e) {
                console.error("Failed to resume playback", e);
            }
        };

        // Try to resume when metadata is loaded
        video.addEventListener('loadedmetadata', resumePlayback);

        return () => {
            saveProgress(); // Save on unmount
            clearInterval(intervalId);
            video.removeEventListener('pause', saveProgress);
            window.removeEventListener('beforeunload', saveProgress);
            video.removeEventListener('loadedmetadata', resumePlayback);
        };
    }, [contentId, moduleId, moduleName, moduleUrl, showTitle, episodeTitle, episodeNumber, poster, streamUrl, headers, subtitles]);

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setFullscreen(
                document.fullscreenElement === containerRef.current ||
                document.webkitFullscreenElement === containerRef.current
            );
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const video = videoRef.current;
            if (!video) return;

            // Prevent default for keys we're handling
            if (['Space', 'KeyF', 'KeyM', 'Escape', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }

            switch (e.code) {
                case 'Space':
                    if (!spacebarHeldRef.current) {
                        spacebarHeldRef.current = true;
                        // Start timer for hold detection (0.5s)
                        spacebarTimerRef.current = setTimeout(() => {
                            originalPlaybackRateRef.current = video.playbackRate;
                            video.playbackRate = 2.0;
                            setIs2xSpeed(true);
                        }, 500);
                    }
                    break;
                case 'KeyF':
                    toggleFullscreen();
                    break;
                case 'KeyM':
                    const newMuted = !videoRef.current.muted;
                    videoRef.current.muted = newMuted;
                    setMuted(newMuted);
                    break;
                case 'Escape':
                    if (document.fullscreenElement) {
                        if (document.exitFullscreen) document.exitFullscreen();
                    } else {
                        onBack();
                    }
                    break;
                case 'ArrowLeft':
                    video.currentTime = Math.max(0, video.currentTime - 5);
                    break;
                case 'ArrowRight':
                    video.currentTime = Math.min(video.duration, video.currentTime + 5);
                    break;
            }
        };

        const handleKeyUp = (e) => {
            const video = videoRef.current;
            if (!video) return;

            if (e.code === 'Space') {
                // Clear any pending timer
                if (spacebarTimerRef.current) {
                    clearTimeout(spacebarTimerRef.current);
                    spacebarTimerRef.current = null;
                }

                if (is2xSpeed) {
                    // Was holding > 0.5s (2x mode active)
                    video.playbackRate = originalPlaybackRateRef.current;
                    setIs2xSpeed(false);
                    // Do NOT toggle play/pause here, just return to normal speed
                } else {
                    // Was a short press logic (< 0.5s)
                    togglePlay();
                }

                spacebarHeldRef.current = false;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            if (spacebarTimerRef.current) clearTimeout(spacebarTimerRef.current);
        };
    }, [onBack, is2xSpeed]); // Depend on is2xSpeed to correct logic in keyup

    // HLS / Source Logic - Also blocked by isReady
    useEffect(() => {
        if (!isReady) return;

        const video = videoRef.current;
        if (!video) return;

        setError(null);
        recoveryAttemptsRef.current = 0;

        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
        }
        loadTimeoutRef.current = setTimeout(() => {
            if (!video.readyState || video.readyState < 2) {
                setError({
                    type: 'timeout',
                    message: 'Stream took too long to load. Trying another stream...'
                });
                setTimeout(() => {
                    if (onRetry) onRetry();
                }, 2000);
            }
        }, 10000);

        if (subtitles && Array.isArray(subtitles) && subtitles.length > 0) {
            Array.from(video.children).forEach(child => {
                if (child.tagName === 'TRACK') {
                    video.removeChild(child);
                }
            });

            subtitles.forEach((subUrl, index) => {
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = `Subtitles ${index + 1}`;
                track.srclang = 'en';
                track.src = '/api/proxy?url=' + encodeURIComponent(subUrl);
                if (index === 0) {
                    track.default = true;
                }
                video.appendChild(track);
            });
        }

        const isHls = streamUrl.includes('.m3u8');

        if (isHls && Hls.isSupported()) {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }

            // Custom loader that proxies ALL HLS requests (manifest + segments)
            class ProxyLoader extends Hls.DefaultConfig.loader {
                constructor(config) {
                    super(config);
                    const load = this.load.bind(this);
                    this.load = function (context, config, callbacks) {
                        // Proxy the URL through our CORS proxy
                        const originalUrl = context.url;
                        context.url = '/api/proxy?url=' + encodeURIComponent(originalUrl);

                        // Call the original load with modified context
                        return load(context, config, callbacks);
                    };
                }
            }

            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90,
                debug: false,
                loader: ProxyLoader,
                xhrSetup: function (xhr, url) {
                    // Set custom headers if provided
                    if (headers) {
                        for (const [key, value] of Object.entries(headers)) {
                            xhr.setRequestHeader(key, value);
                        }
                    }
                }
            });
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (loadTimeoutRef.current) {
                    clearTimeout(loadTimeoutRef.current);
                }

                // Get available quality levels
                if (hls.levels && hls.levels.length > 0) {
                    const levelsList = hls.levels.map((level, index) => ({
                        index,
                        height: level.height,
                        bitrate: level.bitrate,
                        name: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`
                    }));
                    setQualities(levelsList);
                    setCurrentQuality(hls.currentLevel);
                }

                video.play().catch(e => console.error("Auto-play failed:", e));
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error("HLS Error:", data);
                if (data.fatal) {
                    const maxRecoveryAttempts = 3;

                    if (data.details === 'bufferAddCodecError' ||
                        (data.error && data.error.message && data.error.message.includes('not supported'))) {
                        setError({
                            type: 'codec',
                            message: 'This stream uses an incompatible codec. Trying another stream...'
                        });
                        setTimeout(() => {
                            if (onRetry) onRetry();
                        }, 2000);
                        hls.destroy();
                        return;
                    }

                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (recoveryAttemptsRef.current < maxRecoveryAttempts) {
                                recoveryAttemptsRef.current++;
                                hls.startLoad();
                            } else {
                                setError({
                                    type: 'network',
                                    message: 'Network error loading stream. Trying another stream...'
                                });
                                setTimeout(() => {
                                    if (onRetry) onRetry();
                                }, 2000);
                                hls.destroy();
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            if (recoveryAttemptsRef.current < maxRecoveryAttempts) {
                                recoveryAttemptsRef.current++;
                                hls.recoverMediaError();
                            } else {
                                setError({
                                    type: 'media',
                                    message: 'Media error playing stream. Trying another stream...'
                                });
                                setTimeout(() => {
                                    if (onRetry) onRetry();
                                }, 2000);
                                hls.destroy();
                            }
                            break;
                        default:
                            setError({
                                type: 'unknown',
                                message: 'Playback error. Trying another stream...'
                            });
                            setTimeout(() => {
                                if (onRetry) onRetry();
                            }, 2000);
                            hls.destroy();
                            break;
                    }
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                if (loadTimeoutRef.current) {
                    clearTimeout(loadTimeoutRef.current);
                }
                video.play().catch(e => console.error("Auto-play failed:", e));
            });
        } else {
            video.src = streamUrl;
            video.play().catch(e => console.error("Auto-play failed:", e));
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
            if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
            }
        };
    }, [streamUrl, headers, subtitles, onRetry, isReady]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        if (newVolume === 0) {
            setMuted(true);
            videoRef.current.muted = true;
        } else {
            setMuted(false);
            videoRef.current.muted = false;
        }
    };

    const toggleMute = () => {
        const newMuted = !muted;
        videoRef.current.muted = newMuted;
        setMuted(newMuted);
    };

    const skip = (seconds) => {
        videoRef.current.currentTime += seconds;
    };

    const handleProgressClick = (e) => {
        const rect = progressBarRef.current.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pos * duration;
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!fullscreen) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.mozRequestFullScreen) {
                container.mozRequestFullScreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    };

    const togglePiP = async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current.requestPictureInPicture();
            }
        } catch (error) {
            console.error('PiP error:', error);
        }
    };

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = streamUrl;
        a.download = 'video.mp4';
        a.click();
    };

    const changePlaybackSpeed = (rate) => {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
        setShowSettings(false);
    };

    const changeQuality = (levelIndex) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex;
            setCurrentQuality(levelIndex);
            setShowSettings(false);
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            className={`fixed inset-0 bg-black z-50 flex flex-col ${showControls ? '' : 'cursor-none'}`}
            onMouseMove={resetControlsTimeout}
            onClick={resetControlsTimeout}
        >
            {/* Header (Back button + Episode Info) */}
            <div className={`absolute top-0 left-0 right-0 h-40 p-4 bg-gradient-to-b from-black/80 to-transparent z-[25] transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="relative flex items-center min-h-[48px] pointer-events-auto">

                    {/* Top Left Controls Container */}
                    <div className="flex items-center gap-2 absolute left-0 z-30">
                        {/* Back Button */}
                        <button
                            onClick={onBack}
                            className="text-white hover:text-accent transition-colors flex items-center bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm group border border-white/5 hover:bg-white/10"
                            title="Close Player"
                        >
                            <svg className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="font-semibold text-sm">Close</span>
                        </button>

                        {/* Info Button */}
                        {onShowInfo && (
                            <button
                                onClick={onShowInfo}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-white/10 border border-white/5 text-white hover:text-accent transition-all backdrop-blur-sm"
                                title="Media Info"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        )}

                        {/* Episodes Button - Always Visible for Stability */}
                        <div className={`transition-all duration-500 ease-out overflow-hidden max-w-xs opacity-100`}>
                            <button
                                onClick={() => {
                                    if (episodes && episodes.length > 0) {
                                        setShowEpisodeSelector(!showEpisodeSelector);
                                        setShowSettings(false);
                                        setShowCaptionMenu(false);
                                    }
                                }}
                                disabled={!episodes || episodes.length === 0}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 border border-white/5 transition-all backdrop-blur-sm whitespace-nowrap ${showEpisodeSelector ? 'bg-white/20 text-accent' : ''} ${(!episodes || episodes.length === 0) ? 'opacity-50 cursor-not-allowed text-white/50' : 'hover:bg-white/10 text-white hover:text-accent'}`}
                                title="Episodes"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span className="font-semibold text-sm hidden sm:block">Episodes</span>
                            </button>
                        </div>
                    </div>

                    {/* Centered Title */}
                    {(showTitle || episodeTitle) && (
                        <div className="w-full text-center drop-shadow-md px-16 pointer-events-none">
                            {showTitle && <div className="text-white font-bold text-xl leading-tight opacity-90">{showTitle}</div>}
                            {episodeTitle && <div className="text-white/80 text-sm font-medium tracking-wide">{episodeTitle}</div>}
                        </div>
                    )}
                </div>

                {/* Episode Selector Overlay - Horizontal with Images */}
                {showEpisodeSelector && episodes && episodes.length > 0 && (
                    <div className="absolute top-20 left-4 w-[calc(100%-32px)] max-w-5xl bg-black/80 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl flex flex-col pointer-events-auto animate-fadeIn z-50">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-white font-bold text-lg">Episodes</h3>
                            <button onClick={() => setShowEpisodeSelector(false)} className="text-white/50 hover:text-white">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="overflow-x-auto p-4 flex gap-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                            {episodes.map(episode => {
                                const isCurrent = String(episode.number || episode.id) === String(episodeNumber);
                                // Try multiple fields for the image
                                let imgUrl = null;
                                if (episode.still_path) imgUrl = `https://image.tmdb.org/t/p/w500${episode.still_path}`;
                                else if (episode.image) imgUrl = episode.image;
                                else if (episode.img) imgUrl = episode.img;
                                else if (episode.thumbnail) imgUrl = episode.thumbnail;
                                else imgUrl = poster; // Fallback to show poster

                                return (
                                    <div
                                        key={episode.id}
                                        onClick={() => {
                                            if (onPlayEpisode) {
                                                onPlayEpisode(episode);
                                                setShowEpisodeSelector(false);
                                            }
                                        }}
                                        className={`flex-shrink-0 w-64 rounded-lg cursor-pointer transition-all flex flex-col gap-2 group relative overflow-hidden bg-white/5 hover:bg-white/10 border ${isCurrent ? 'border-accent' : 'border-transparent'}`}
                                    >
                                        {/* Thumbnail */}
                                        <div className="aspect-video w-full bg-black/50 relative">
                                            {imgUrl ? (
                                                <img src={imgUrl} alt={episode.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-white/20">
                                                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                </div>
                                            )}
                                            {isCurrent && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                    <span className="text-accent font-bold bg-black/60 px-2 py-1 rounded backdrop-blur-md border border-accent/50 text-xs uppercase tracking-wide">Playing</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="p-3 pt-1">
                                            <div className="text-white/60 text-xs font-mono mb-1">
                                                Episode {episode.number}
                                            </div>
                                            <div className={`text-sm font-bold leading-tight line-clamp-2 ${isCurrent ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                                                {episode.title || `Episode ${episode.number}`}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Video */}
            <div className="flex-1 flex items-center justify-center relative" onClick={togglePlay}>
                <video
                    ref={videoRef}
                    className="w-full h-full max-h-screen object-contain"
                />

                {/* Buffering Indicator */}
                {buffering && !error && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}

                {/* 2x Speed Indicator - Top Center - Moved further up */}
                {is2xSpeed && (
                    <div className="absolute top-[10%] left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none z-20 transition-all duration-200">
                        <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-lg">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                            <span className="text-white font-semibold text-lg">2x Speed</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-8 z-30" onClick={(e) => e.stopPropagation()}>
                        <div className="max-w-md text-center">
                            <div className="mb-6">
                                <svg className="w-16 h-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="2xl font-bold text-white mb-4">Playback Error</h3>
                            <p className="text-secondary text-lg mb-8">{error.message}</p>
                            <button
                                onClick={onBack}
                                className="bg-accent px-8 py-3 rounded-lg hover:bg-accent/80 transition-all font-medium"
                                style={{ color: 'var(--color-text-on-accent)' }}
                            >
                                Try Another Stream
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom Controls */}
            <div
                className={`absolute bottom-0 left-0 right-0 pt-24 bg-gradient-to-t from-black/80 to-transparent z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress Bar Container - YouTube Style */}
                <div className="px-4 pb-2 pt-4 w-full group/progress relative">
                    {/* Hover Hit Area */}
                    <div
                        ref={progressBarRef}
                        className="absolute top-0 left-0 right-0 bottom-0 cursor-pointer z-10"
                        onMouseMove={(e) => {
                            if (!progressBarRef.current || duration <= 0) return;
                            const rect = progressBarRef.current.getBoundingClientRect();
                            const pos = (e.clientX - rect.left) / rect.width;
                            setHoverPosition(pos * 100);
                            setHoverTime(pos * duration);
                        }}
                        onMouseLeave={() => {
                            setHoverTime(null);
                            setHoverPosition(null);
                        }}
                        onClick={handleProgressClick}
                    />

                    {/* Hover Tooltip - Lowered but not touching */}
                    {hoverTime !== null && hoverPosition !== null && (
                        <div
                            className="absolute bottom-6 mb-1 px-2 py-1 bg-black/90 rounded text-xs font-medium text-white pointer-events-none transform -translate-x-1/2 border border-white/10 shadow-xl z-20 whitespace-nowrap"
                            style={{ left: `${hoverPosition}%` }}
                        >
                            {formatTime(hoverTime)}
                        </div>
                    )}

                    {/* Visual Track Container */}
                    <div className="relative w-full h-[4px] group-hover/progress:h-[6px] bg-white/20 rounded-sm transition-all duration-200 ease-out mt-2 mb-2 pointer-events-none">
                        {/* Buffered Ranges */}
                        {buffered.map((range, index) => {
                            const startParams = (range.start / duration) * 100;
                            const widthParams = ((range.end - range.start) / duration) * 100;
                            return (
                                <div
                                    key={index}
                                    className="absolute top-0 bottom-0 bg-white/30 rounded-full transition-all duration-300"
                                    style={{
                                        left: `${startParams}%`,
                                        width: `${widthParams}%`
                                    }}
                                />
                            );
                        })}

                        {/* Play Progress */}
                        <div
                            className="absolute top-0 left-0 bottom-0 bg-accent rounded-sm transition-all duration-75 z-10"
                            style={{ width: `${progress}%` }}
                        >
                            {/* Scrubber Handle (Circle) - Always Visible */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-accent rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] border-[1.5px] border-white transition-transform duration-200 origin-center hover:scale-125" />
                        </div>
                    </div>
                </div>

                {/* Controls Container */}
                <div className="flex items-center justify-between px-6 pb-6 pt-1">
                    {/* Left Controls */}
                    <div className="flex items-center gap-4">
                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            className="text-white hover:text-accent transition-all duration-200 hover:scale-125 p-1"
                        >
                            {playing ? (
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>

                        {/* Volume with custom hover slider */}
                        <div className="flex items-center gap-0 group/volume relative">
                            <button
                                onClick={toggleMute}
                                className="text-white hover:text-accent transition-all duration-200 p-2 z-20"
                            >
                                {muted || volume === 0 ? (
                                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                                    </svg>
                                )}
                            </button>

                            {/* Slider Container - Expands on hover */}
                            <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300 ease-out flex items-center pr-2">
                                <div
                                    className="h-8 w-full flex items-center px-1 cursor-pointer bg-transparent relative"
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const pos = (e.clientX - rect.left - 4) / (rect.width - 8); // Padding adjustment
                                        const newVol = Math.max(0, Math.min(1, pos));

                                        if (videoRef.current) {
                                            videoRef.current.volume = newVol;
                                            videoRef.current.muted = false;
                                        }
                                        setVolume(newVol);
                                        setMuted(false);
                                    }}
                                >
                                    {/* Track */}
                                    <div className="w-full h-1 bg-white/30 rounded-full relative">
                                        {/* Volume Fill */}
                                        <div
                                            className="absolute top-0 left-0 bottom-0 bg-white rounded-full"
                                            style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                                        />

                                        {/* Handle (Visible heavily on hover) */}
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-sm opacity-0 group-hover/volume:opacity-100 transition-opacity duration-200"
                                            style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Time */}
                        <span className="text-white text-sm tabular-nums font-medium opacity-90">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3">
                        {/* Download */}
                        <button
                            onClick={handleDownload}
                            className="text-white hover:text-accent transition-all duration-200 p-2 hover:scale-125"
                            title="Download"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>

                        {/* Picture-in-Picture */}
                        <button
                            onClick={togglePiP}
                            className="text-white hover:text-accent transition-all duration-200 p-2 hover:scale-125"
                            title="Picture in Picture"
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" />
                            </svg>
                        </button>

                        {/* Subtitles */}
                        {/* Subtitles (Menu) */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowCaptionMenu(!showCaptionMenu);
                                    setShowSettings(false); // Close other menu
                                }}
                                className={`text-white hover:text-accent transition-all duration-200 p-2 hover:scale-125 ${showSubtitles ? 'opacity-100' : 'opacity-50'}`}
                                title="Caption Settings"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                            </button>

                            {showCaptionMenu && (
                                <div className="absolute bottom-full right-0 mb-4 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl min-w-[280px] overflow-hidden animate-fadeIn z-50 p-4">
                                    <h3 className="text-white font-semibold mb-3 border-b border-white/10 pb-2 flex justify-between items-center">
                                        Captions
                                        {videoRef.current?.textTracks.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    const video = videoRef.current;
                                                    if (video && video.textTracks.length > 0) {
                                                        const track = video.textTracks[0];
                                                        const newMode = track.mode === 'showing' ? 'hidden' : 'showing';
                                                        track.mode = newMode;
                                                        setShowSubtitles(newMode === 'showing');
                                                    }
                                                }}
                                                className={`text-xs px-2 py-1 rounded border ${showSubtitles ? 'bg-accent border-accent' : 'border-white/20 text-secondary'}`}
                                                style={showSubtitles ? { color: 'var(--color-text-on-accent)' } : {}}
                                            >
                                                {showSubtitles ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                    </h3>

                                    {(!videoRef.current || videoRef.current.textTracks.length === 0) && (
                                        <p className="text-secondary text-xs italic mb-4 text-center">No subtitles available</p>
                                    )}

                                    {videoRef.current?.textTracks.length > 0 ? (
                                        <div className="space-y-4">
                                            {/* Size */}
                                            <div>
                                                <div className="text-secondary text-xs mb-1">Size</div>
                                                <div className="flex gap-1">
                                                    {['75%', '100%', '125%', '150%'].map(size => (
                                                        <button
                                                            key={size}
                                                            onClick={() => handleSubSettingChange('size', size)}
                                                            className={`flex-1 py-1 rounded text-xs border transition-colors ${subSettings.size === size ? 'bg-accent border-accent' : 'border-white/10 text-white hover:bg-white/10'}`}
                                                            style={subSettings.size === size ? { color: 'var(--color-text-on-accent)' } : {}}
                                                        >
                                                            {size === '75%' ? 'S' : size === '100%' ? 'M' : size === '125%' ? 'L' : 'XL'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Color */}
                                            <div>
                                                <div className="text-secondary text-xs mb-1">Color</div>
                                                <div className="flex gap-2 justify-between">
                                                    {[
                                                        { v: '#ffffff', n: 'White' },
                                                        { v: '#ffff00', n: 'Yellow' },
                                                        { v: '#00ffff', n: 'Cyan' },
                                                        { v: '#00ff00', n: 'Green' }
                                                    ].map(c => (
                                                        <button
                                                            key={c.v}
                                                            onClick={() => handleSubSettingChange('color', c.v)}
                                                            className={`flex-1 h-8 rounded border transition-all relative overflow-hidden ${subSettings.color === c.v ? 'border-white ring-2 ring-white/20 scale-105' : 'border-white/10 hover:border-white/50'}`}
                                                            style={{ backgroundColor: c.v }}
                                                            title={c.n}
                                                        >
                                                            {subSettings.color === c.v && (
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Background Opacity */}
                                            <div>
                                                <div className="text-secondary text-xs mb-1">Background</div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={subSettings.bgOpacity}
                                                        onChange={(e) => handleSubSettingChange('bgOpacity', e.target.value)}
                                                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                                                    />
                                                    <span className="text-white text-[10px] w-6">
                                                        {Math.round(subSettings.bgOpacity * 100)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Outline Toggle */}
                                            <div>
                                                <div className="text-secondary text-xs mb-1">Outline</div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleSubSettingChange('outline', 'none')}
                                                        className={`flex-1 text-xs py-1.5 px-3 rounded border transition-colors ${subSettings.outline === 'none'
                                                            ? 'bg-accent border-accent'
                                                            : 'border-white/10 text-white hover:bg-white/10'}`}
                                                        style={subSettings.outline === 'none' ? { color: 'var(--color-text-on-accent)' } : {}}
                                                    >
                                                        Off
                                                    </button>
                                                    <button
                                                        onClick={() => handleSubSettingChange('outline', 'outline')}
                                                        className={`flex-1 text-xs py-1.5 px-3 rounded border transition-colors ${subSettings.outline === 'outline'
                                                            ? 'bg-accent border-accent'
                                                            : 'border-white/10 text-white hover:bg-white/10'}`}
                                                        style={subSettings.outline === 'outline' ? { color: 'var(--color-text-on-accent)' } : {}}
                                                    >
                                                        On
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center">
                                            <p className="text-secondary text-sm">No subtitles available for this stream.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Settings */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowSettings(!showSettings);
                                    setSettingsSubMenu(null);
                                    setShowCaptionMenu(false);
                                }}
                                className="text-white hover:text-accent transition-all duration-200 p-2 hover:scale-125"
                                title="Settings"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>

                            {showSettings && (
                                <div className="absolute bottom-full right-0 mb-4 bg-black/70 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl min-w-[200px] overflow-hidden animate-fadeIn z-50">
                                    {settingsSubMenu === null ? (
                                        /* Main Menu */
                                        <div className="py-2">
                                            <button
                                                onClick={() => setSettingsSubMenu('speed')}
                                                className="w-full px-4 py-2 text-left hover:bg-white/10 transition-colors text-white text-sm flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    Playback Speed
                                                </div>
                                                <div className="flex items-center gap-1 text-secondary group-hover:text-white transition-colors">
                                                    <span className="text-xs">{playbackRate}x</span>
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>

                                            {qualities.length > 0 && (
                                                <button
                                                    onClick={() => setSettingsSubMenu('quality')}
                                                    className="w-full px-4 py-2 text-left hover:bg-white/10 transition-colors text-white text-sm flex items-center justify-between group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                        </svg>
                                                        Quality
                                                    </div>
                                                    <div className="flex items-center gap-1 text-secondary group-hover:text-white transition-colors">
                                                        <span className="text-xs">
                                                            {currentQuality === -1 ? 'Auto' : qualities.find(q => q.index === currentQuality)?.name || 'Unknown'}
                                                        </span>
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    ) : settingsSubMenu === 'speed' ? (
                                        /* Speed Sub-menu */
                                        <div>
                                            <div className="flex items-center p-2 border-b border-white/10 mb-1">
                                                <button
                                                    onClick={() => setSettingsSubMenu(null)}
                                                    className="text-white hover:bg-white/10 p-1 rounded transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                    </svg>
                                                </button>
                                                <span className="text-white text-sm font-semibold ml-2">Playback Speed</span>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-1">
                                                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                                                    <button
                                                        key={rate}
                                                        onClick={() => {
                                                            changePlaybackSpeed(rate);
                                                            // Optional: stay in menu or close. YouTube closes.
                                                            setShowSettings(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${playbackRate === rate
                                                            ? 'bg-accent text-white'
                                                            : 'text-white/80 hover:bg-white/10'
                                                            }`}
                                                        style={playbackRate === rate ? { color: 'var(--color-text-on-accent)' } : {}}
                                                    >
                                                        {playbackRate === rate && (
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                        <span className={playbackRate === rate ? 'font-medium ml-1' : 'ml-6'}>
                                                            {rate}x {rate === 1 && '(Normal)'}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        /* Quality Sub-menu */
                                        <div>
                                            <div className="flex items-center p-2 border-b border-white/10 mb-1">
                                                <button
                                                    onClick={() => setSettingsSubMenu(null)}
                                                    className="text-white hover:bg-white/10 p-1 rounded transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                    </svg>
                                                </button>
                                                <span className="text-white text-sm font-semibold ml-2">Quality</span>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-1">
                                                <button
                                                    onClick={() => changeQuality(-1)}
                                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${currentQuality === -1
                                                        ? 'bg-accent text-white'
                                                        : 'text-white/80 hover:bg-white/10'
                                                        }`}
                                                    style={currentQuality === -1 ? { color: 'var(--color-text-on-accent)' } : {}}
                                                >
                                                    {currentQuality === -1 && (
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                    <span className={currentQuality === -1 ? 'font-medium ml-1' : 'ml-6'}>Auto</span>
                                                </button>
                                                {qualities.map(quality => (
                                                    <button
                                                        key={quality.index}
                                                        onClick={() => changeQuality(quality.index)}
                                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${currentQuality === quality.index
                                                            ? 'bg-accent text-white'
                                                            : 'text-white/80 hover:bg-white/10'
                                                            }`}
                                                        style={currentQuality === quality.index ? { color: 'var(--color-text-on-accent)' } : {}}
                                                    >
                                                        {currentQuality === quality.index && (
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                        <span className={currentQuality === quality.index ? 'font-medium ml-1' : 'ml-6'}>
                                                            {quality.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Fullscreen */}
                        <button
                            onClick={toggleFullscreen}
                            className="text-white hover:text-accent transition-all duration-200 p-2 hover:scale-125"
                            title="Fullscreen"
                        >
                            {fullscreen ? (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default VideoPlayer;
