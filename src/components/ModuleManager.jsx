import React, { useState, useEffect } from 'react';

const ModuleManager = ({ modules, activeModuleId, onAddModule, onDeleteModule, onUpdateModule, onSwitchModule, onClose }) => {
    const [moduleUrl, setModuleUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [showImportMenu, setShowImportMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [notification, setNotification] = useState(null); // { message, type }
    const [deletingModuleId, setDeletingModuleId] = useState(null);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // ESC key to close
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!moduleUrl.trim()) return;

        setIsAdding(true);
        const results = {
            added: [],
            skipped: [],
            failed: []
        };

        try {
            // Split by comma and trim each URL
            const urls = moduleUrl.split(',').map(url => url.trim()).filter(url => url);

            // Load all modules
            for (const url of urls) {
                try {
                    await onAddModule(url);
                    results.added.push(url);
                } catch (error) {
                    if (error.message.includes('already exists')) {
                        results.skipped.push(url);
                    } else {
                        results.failed.push({ url, error: error.message });
                    }
                }
            }

            // Show summary
            let message = '';
            if (results.added.length > 0) {
                message += `✓ Added ${results.added.length} module(s)\n`;
            }
            if (results.skipped.length > 0) {
                message += `⊘ Skipped ${results.skipped.length} duplicate(s)\n`;
            }
            if (results.failed.length > 0) {
                message += `✗ Failed ${results.failed.length} module(s)\n`;
            }

            if (message) {
                showNotification(message.trim(), 'success');
            }

            setModuleUrl('');
        } catch (error) {
            // Error is handled by parent
        } finally {
            setIsAdding(false);
        }
    };

    const handleExportToFile = () => {
        const exportData = {
            modules: modules.map(m => ({
                url: m.url,
                name: m.name
            })),
            activeModuleId,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sora-modules-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const handleExportToClipboard = async () => {
        // Export as comma-separated URLs for easy copy-paste into the add field
        const urls = modules.map(m => m.url).join(', ');

        try {
            await navigator.clipboard.writeText(urls);
            showNotification('Module URLs copied to clipboard!', 'success');
            setShowExportMenu(false);
        } catch (error) {
            showNotification('Failed to copy to clipboard: ' + error.message, 'error');
        }
    };

    const handleImportFromFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const results = {
                added: [],
                skipped: [],
                failed: []
            };

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!data.modules || !Array.isArray(data.modules)) {
                    showNotification('Invalid module export file', 'error');
                    return;
                }

                setIsAdding(true);
                for (const module of data.modules) {
                    try {
                        await onAddModule(module.url);
                        results.added.push(module.url);
                    } catch (error) {
                        if (error.message.includes('already exists')) {
                            results.skipped.push(module.url);
                        } else {
                            results.failed.push({ url: module.url, error: error.message });
                        }
                    }
                }

                // Show summary
                let message = '';
                if (results.added.length > 0) {
                    message += `✓ Added ${results.added.length} module(s)\n`;
                }
                if (results.skipped.length > 0) {
                    message += `⊘ Skipped ${results.skipped.length} duplicate(s)\n`;
                }
                if (results.failed.length > 0) {
                    message += `✗ Failed ${results.failed.length} module(s)\n`;
                }
                if (message) {
                    showNotification(message.trim(), 'success');
                }

                setIsAdding(false);
                setShowImportMenu(false);
            } catch (error) {
                showNotification('Failed to import modules: ' + error.message, 'error');
                setIsAdding(false);
            }
        };
        input.click();
    };

    const handleImportFromClipboard = async () => {
        const results = {
            added: [],
            skipped: [],
            failed: []
        };

        try {
            const text = await navigator.clipboard.readText();

            // Try to detect format - if it has commas but no braces, it's a URL list
            let urls = [];
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                // JSON format
                const data = JSON.parse(text);
                if (!data.modules || !Array.isArray(data.modules)) {
                    showNotification('Invalid module data in clipboard', 'error');
                    return;
                }
                urls = data.modules.map(m => m.url);
            } else {
                // Comma-separated URLs
                urls = text.split(',').map(url => url.trim()).filter(url => url);
            }

            if (urls.length === 0) {
                showNotification('No valid module URLs found in clipboard', 'error');
                return;
            }

            setIsAdding(true);
            for (const url of urls) {
                try {
                    await onAddModule(url);
                    results.added.push(url);
                } catch (error) {
                    if (error.message.includes('already exists')) {
                        results.skipped.push(url);
                    } else {
                        results.failed.push({ url, error: error.message });
                    }
                }
            }

            // Show summary
            let message = '';
            if (results.added.length > 0) {
                message += `✓ Added ${results.added.length} module(s)\n`;
            }
            if (results.skipped.length > 0) {
                message += `⊘ Skipped ${results.skipped.length} duplicate(s)\n`;
            }
            if (results.failed.length > 0) {
                message += `✗ Failed ${results.failed.length} module(s)\n`;
            }
            if (message) {
                showNotification(message.trim(), 'success');
            }

            setIsAdding(false);
            setShowImportMenu(false);
        } catch (error) {
            showNotification('Failed to import from clipboard: ' + error.message, 'error');
            setIsAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4">
            {notification && (
                <div
                    className={`fixed top-8 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-lg shadow-xl font-medium animate-fadeIn ${notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-accent'}`}
                    style={notification.type !== 'error' ? { color: 'var(--color-text-on-accent)' } : {}}
                >
                    <pre className="whitespace-pre-wrap font-sans">{notification.message}</pre>
                </div>
            )}
            <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <h2 className="text-2xl font-bold text-white">Module Manager</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Import Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowImportMenu(!showImportMenu)}
                                disabled={isAdding}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Import
                            </button>

                            {showImportMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowImportMenu(false)}></div>
                                    <div className="absolute right-0 mt-2 w-48 bg-surface border border-white/10 rounded-lg shadow-2xl z-50">
                                        <div className="py-1">
                                            <button
                                                onClick={handleImportFromClipboard}
                                                className="w-full text-left px-4 py-2 hover:bg-white/5 text-white transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                                From Clipboard
                                            </button>
                                            <button
                                                onClick={handleImportFromFile}
                                                className="w-full text-left px-4 py-2 hover:bg-white/5 text-white transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                From File
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Export Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                disabled={modules.length === 0}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export
                            </button>

                            {showExportMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>
                                    <div className="absolute right-0 mt-2 w-48 bg-surface border border-white/10 rounded-lg shadow-2xl z-50">
                                        <div className="py-1">
                                            <button
                                                onClick={handleExportToClipboard}
                                                className="w-full text-left px-4 py-2 hover:bg-white/5 text-white transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                                To Clipboard
                                            </button>
                                            <button
                                                onClick={handleExportToFile}
                                                className="w-full text-left px-4 py-2 hover:bg-white/5 text-white transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                To File
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="text-secondary hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Add Module Form */}
                <div className="p-6 border-b border-white/10">
                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <input
                            type="text"
                            value={moduleUrl}
                            onChange={(e) => setModuleUrl(e.target.value)}
                            placeholder="Enter module URL(s) - separate multiple with commas..."
                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-secondary focus:outline-none focus:border-accent"
                            disabled={isAdding}
                        />
                        <button
                            type="submit"
                            disabled={isAdding || !moduleUrl.trim()}
                            className="bg-accent hover:bg-accent/80 disabled:bg-accent/50 padding-fix px-6 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
                            style={{ color: 'var(--color-text-on-accent)' }}
                        >
                            {isAdding ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Module{moduleUrl.includes(',') ? 's' : ''}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Module List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {modules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-secondary">
                            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-lg">No modules loaded</p>
                            <p className="text-sm mt-2">Add a module URL above to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {modules.map((module) => {
                                const isActive = module.id === activeModuleId;
                                return (
                                    <div
                                        key={module.id}
                                        className={`border rounded-lg p-4 transition-all cursor-pointer ${isActive
                                            ? 'border-accent bg-accent/10'
                                            : 'border-white/10 bg-black/30 hover:bg-black/50'
                                            }`}
                                        onClick={() => onSwitchModule(module.id)}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-white truncate">
                                                        {module.name}
                                                    </h3>
                                                    {isActive && (
                                                        <span className="bg-accent px-2 py-0.5 rounded-full text-xs font-medium" style={{
                                                            color: 'var(--color-text-on-accent)'
                                                        }}>
                                                            Active
                                                        </span>
                                                    )}

                                                </div>
                                                <p className="text-sm text-secondary truncate">
                                                    {module.url}
                                                </p>
                                                <p className="text-xs text-secondary/60 mt-1 flex items-center gap-2">
                                                    <span>v{module.manifest?.version || '1.0.0'}</span>
                                                    <span>•</span>
                                                    <span>Last updated: {new Date(module.lastUpdated).toLocaleString()}</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateModule(module.id);
                                                    }}
                                                    className="text-secondary hover:text-accent transition-colors p-2"
                                                    title="Update module"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(module.url);
                                                        showNotification('Link copied!', 'success');
                                                    }}
                                                    className="text-secondary hover:text-accent transition-colors p-2"
                                                    title="Copy Module Link"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                                {deletingModuleId === module.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteModule(module.id);
                                                                setDeletingModuleId(null);
                                                            }}
                                                            className="text-red-500 hover:text-red-400 font-bold text-xs"
                                                        >
                                                            CONFIRM
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeletingModuleId(null);
                                                            }}
                                                            className="text-white/50 hover:text-white text-xs"
                                                        >
                                                            CANCEL
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingModuleId(module.id);
                                                        }}
                                                        className="text-secondary hover:text-red-400 transition-colors p-2"
                                                        title="Delete module"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 text-center text-sm text-secondary">
                    Click a module to activate it
                </div>
            </div>
        </div>
    );
};

export default ModuleManager;
