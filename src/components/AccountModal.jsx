import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { syncService } from '../lib/SyncService';

export default function AccountModal({ onClose }) {
    const { user, signOut } = useAuth();
    const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'

    const handleManualSync = async () => {
        if (!user) return;

        setSyncStatus('syncing');
        try {
            // Sync all data
            const modulesStr = localStorage.getItem('sora_modules');
            const activeModuleUrl = localStorage.getItem('active_module_url');
            if (modulesStr) {
                const modules = JSON.parse(modulesStr);
                await syncService.syncModules(modules, activeModuleUrl);
            }

            const historyStr = localStorage.getItem('sora_watch_history');
            if (historyStr) {
                const history = JSON.parse(historyStr);
                await syncService.syncWatchHistory(history);
            }

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

            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (error) {
            console.error('Manual sync failed:', error);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            sessionStorage.removeItem('supabase_initial_sync');
            onClose();
        } catch (error) {
            // Ignore session missing errors, just close modal
            console.log('[AccountModal] Logout completed');
            sessionStorage.removeItem('supabase_initial_sync');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-surface">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <h2 className="text-2xl font-bold text-white">Account</h2>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Email Display */}
                    <div>
                        <label className="text-secondary text-sm block mb-2">Signed in as</label>
                        <div className="bg-black/30 border border-white/10 rounded-lg px-4 py-3">
                            <p className="text-white font-medium">{user?.email}</p>
                        </div>
                    </div>

                    {/* Sync Section */}
                    <div>
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                            </svg>
                            Cloud Sync
                        </h3>
                        <p className="text-xs text-secondary mb-3">
                            Your settings, modules, and watch history sync automatically every 15 seconds.
                        </p>
                        <button
                            onClick={handleManualSync}
                            disabled={syncStatus === 'syncing'}
                            className="w-full bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-text-on-accent px-4 py-2.5 rounded-lg text-sm transition-all duration-200 font-medium flex items-center justify-center gap-2"
                        >
                            {syncStatus === 'syncing' ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                    Syncing...
                                </>
                            ) : syncStatus === 'success' ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Synced!
                                </>
                            ) : syncStatus === 'error' ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Error
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Sync Now
                                </>
                            )}
                        </button>
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 font-medium border border-red-500/20 flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
