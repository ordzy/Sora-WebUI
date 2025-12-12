import React, { useState, useEffect } from 'react';

const ContinueWatchingList = ({ onPlay, onShowInfo }) => {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const loadHistory = () => {
            try {
                const saved = localStorage.getItem('sora_watch_history');
                const savedHidden = localStorage.getItem('sora_cw_hidden');

                if (saved) {
                    const parsed = JSON.parse(saved);
                    const hiddenIds = savedHidden ? JSON.parse(savedHidden) : [];

                    // 1. Group by Content+Module to deduce unique shows
                    // We want the LATEST episode for each Show+Module combination
                    const latestByShow = {};

                    parsed.forEach(item => {
                        const key = `${item.contentId}-${item.moduleId}`;

                        // If we haven't seen this show, or if this item is more recent than the stored one
                        if (!latestByShow[key] || item.lastWatched > latestByShow[key].lastWatched) {
                            latestByShow[key] = item;
                        }
                    });

                    // 2. Convert to array and sort
                    let uniqueHistory = Object.values(latestByShow).sort((a, b) => b.lastWatched - a.lastWatched);

                    // 3. Filter out "Hidden" shows
                    // The hidden list contains strings of "contentId-moduleId"
                    uniqueHistory = uniqueHistory.filter(item => {
                        const key = `${item.contentId}-${item.moduleId}`;
                        return !hiddenIds.includes(key);
                    });

                    setHistory(uniqueHistory);
                }
            } catch (e) {
                console.error("Failed to load history", e);
            }
        };

        loadHistory();

        // Listen for storage events (in case updated in another tab/component)
        window.addEventListener('storage', loadHistory);
        // Custom event if we want to update immediately from same window
        window.addEventListener('sora-history-updated', loadHistory);

        return () => {
            window.removeEventListener('storage', loadHistory);
            window.removeEventListener('sora-history-updated', loadHistory);
        };
    }, []);

    if (history.length === 0) return null;

    // Helper to format remaining time
    const formatRemaining = (item) => {
        if (item.timestamp < 60) return 'Start Episode';
        const remaining = item.duration - item.timestamp;
        if (remaining < 60) return '< 1m left';
        const mins = Math.floor(remaining / 60);
        return `${mins}m left`;
    };

    const formatTimestamp = (seconds) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleRemove = (e, itemToRemove) => {
        e.stopPropagation();

        // Instead of deleting from history (unwatching), we add to a "Hidden" list
        const key = `${itemToRemove.contentId}-${itemToRemove.moduleId}`;

        try {
            const savedHidden = localStorage.getItem('sora_cw_hidden');
            const hiddenIds = savedHidden ? JSON.parse(savedHidden) : [];

            if (!hiddenIds.includes(key)) {
                const newHidden = [...hiddenIds, key];
                localStorage.setItem('sora_cw_hidden', JSON.stringify(newHidden));

                // Update local state immediately
                setHistory(prev => prev.filter(item => `${item.contentId}-${item.moduleId}` !== key));
            }
        } catch (e) {
            console.error("Failed to hide item", e);
        }
    };

    return (
        <div className="mb-8 px-4 sm:px-8 animate-fadeIn">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Continue Watching
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {history.map((item) => (
                    <div
                        key={`${item.contentId}-${item.moduleId}-${item.episodeNumber}`}
                        className="relative flex-shrink-0 w-48 sm:w-56 aspect-video bg-gray-800 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-accent transition-all group snap-start"
                        onClick={() => onPlay(item)}
                    >
                        {/* Poster/Image */}
                        {item.poster ? (
                            <img src={item.poster} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                                <span className="text-4xl">📺</span>
                            </div>
                        )}

                        {/* Module Name Badge - Top Left (Requested) -- Reduced Opacity */}
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-accent uppercase tracking-wider border border-white/10 opacity-80 group-hover:opacity-100 transition-opacity">
                            {item.moduleName}
                        </div>

                        {/* Top Right Buttons Container */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {/* Info Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onShowInfo(item);
                                }}
                                className="p-1.5 rounded-full bg-black/60 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-sm border border-white/5"
                                title="Show Details"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>

                            {/* Remove Button */}
                            <button
                                onClick={(e) => handleRemove(e, item)}
                                className="p-1.5 rounded-full bg-black/60 hover:bg-red-500/80 text-white/70 hover:text-white transition-all backdrop-blur-sm border border-white/5"
                                title="Remove from history"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Centered Play Button (Hover) */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-accent/90 rounded-full p-2 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                        </div>

                        {/* Bottom Overlay: Episode and Time -- Reduced Opacity */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent p-3 pt-8">
                            {/* Progress Bar */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                <div
                                    className="h-full bg-accent"
                                    style={{ width: `${(item.timestamp / item.duration) * 100}%` }}
                                />
                            </div>

                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-white font-bold text-sm truncate max-w-[120px]" title={item.title}>
                                        {item.title}
                                    </span>
                                    <span className="text-gray-300 text-xs font-medium">
                                        Ep {item.episodeNumber}
                                    </span>
                                </div>
                                <span className="text-accent text-[10px] bg-black/40 px-1 rounded backdrop-blur-sm">
                                    {formatRemaining(item)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContinueWatchingList;
