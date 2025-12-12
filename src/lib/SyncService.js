import { supabase } from './supabase';

/**
 * SyncService - Handles bidirectional sync between localStorage and Supabase
 * Offline-first: Always update localStorage immediately, sync to cloud when authenticated
 */
class SyncService {
    constructor() {
        this.userId = null;
        this.syncQueue = [];
        this.isSyncing = false;
    }

    /**
     * Initialize sync service with user session
     */
    async init(userId) {
        this.userId = userId;
        if (userId) {
            console.log('[SyncService] Initialized for user:', userId);
        }
    }

    /**
     * Clear user data on logout
     */
    async clear() {
        this.userId = null;
        this.syncQueue = [];
    }

    // ============================================
    // SETTINGS SYNC
    // ============================================

    async syncSettings(settings) {
        if (!this.userId) return;

        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: this.userId,
                    theme_id: settings.themeId,
                    accent_color: settings.accentColor,
                    sub_size: settings.subSize,
                    sub_color: settings.subColor,
                    sub_bg_opacity: settings.subBgOpacity,
                    sub_outline: settings.subOutline,
                    auto_activate: settings.autoActivate,
                    auto_refetch_modules: settings.autoRefetchModules,
                    cors_proxy: settings.corsProxy,
                    use_custom_proxy: settings.useCustomProxy,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'  // Update on conflict with user_id
                });

            if (error) throw error;
            console.log('[SyncService] Settings synced');
        } catch (error) {
            console.error('[SyncService] Failed to sync settings:', error);
        }
    }

    async getSettings() {
        if (!this.userId) return null;

        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', this.userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
            return data;
        } catch (error) {
            console.error('[SyncService] Failed to get settings:', error);
            return null;
        }
    }

    // ============================================
    // MODULES SYNC
    // ============================================

    async syncModules(modules, activeModuleUrl) {
        if (!this.userId) return;

        try {
            // Upsert modules (will update existing or insert new)
            if (modules.length > 0) {
                const moduleData = modules.map(m => ({
                    user_id: this.userId,
                    url: m.url,
                    name: m.name,
                    is_active: m.url === activeModuleUrl
                }));

                const { error } = await supabase
                    .from('user_modules')
                    .upsert(moduleData, {
                        onConflict: 'user_id,url',
                        ignoreDuplicates: false
                    });

                if (error) throw error;
            }

            console.log('[SyncService] Modules synced');
        } catch (error) {
            console.error('[SyncService] Failed to sync modules:', error);
        }
    }

    async getModules() {
        if (!this.userId) return null;

        try {
            const { data, error } = await supabase
                .from('user_modules')
                .select('*')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[SyncService] Failed to get modules:', error);
            return null;
        }
    }

    // ============================================
    // WATCH HISTORY SYNC
    // ============================================

    async syncWatchHistory(historyArray) {
        if (!this.userId || !Array.isArray(historyArray)) return;

        try {
            // Upsert history (will update existing or insert new)
            if (historyArray.length > 0) {
                const historyData = historyArray.map(h => ({
                    user_id: this.userId,
                    content_id: String(h.contentId || ''),
                    module_id: h.moduleId,
                    module_url: h.moduleUrl,
                    module_name: h.moduleName,
                    title: h.title,
                    poster: h.poster,
                    episode_number: h.episodeNumber,
                    episode_id: h.episodeId,
                    stream_url: h.streamUrl,
                    headers: h.headers || {},
                    subtitles: h.subtitles || [],
                    timestamp: h.timestamp || 0,
                    duration: h.duration,
                    last_watched_at: h.lastWatched ? new Date(h.lastWatched).toISOString() : new Date().toISOString()
                }));

                const { error } = await supabase
                    .from('watch_history')
                    .upsert(historyData, {
                        onConflict: 'user_id,content_id,episode_number',
                        ignoreDuplicates: false
                    });

                if (error) throw error;
            }

            console.log('[SyncService] Watch history synced');
        } catch (error) {
            console.error('[SyncService] Failed to sync watch history:', error);
        }
    }

    async getWatchHistory() {
        if (!this.userId) return null;

        try {
            const { data, error } = await supabase
                .from('watch_history')
                .select('*')
                .eq('user_id', this.userId)
                .order('last_watched_at', { ascending: false });

            if (error) throw error;

            // Convert to localStorage format
            return data.map(h => ({
                contentId: h.content_id,
                moduleId: h.module_id,
                moduleUrl: h.module_url,
                moduleName: h.module_name,
                title: h.title,
                poster: h.poster,
                episodeNumber: h.episode_number,
                episodeId: h.episode_id,
                streamUrl: h.stream_url,
                headers: h.headers,
                subtitles: h.subtitles,
                timestamp: h.timestamp,
                duration: h.duration,
                lastWatched: new Date(h.last_watched_at).getTime()
            }));
        } catch (error) {
            console.error('[SyncService] Failed to get watch history:', error);
            return null;
        }
    }

    // ============================================
    // HIDDEN ITEMS SYNC
    // ============================================

    async syncHiddenItems(hiddenArray) {
        if (!this.userId || !Array.isArray(hiddenArray)) return;

        try {
            // Upsert hidden items
            if (hiddenArray.length > 0) {
                const hiddenData = hiddenArray.map(h => ({
                    user_id: this.userId,
                    content_id: String(h.contentId || ''),
                    episode_number: h.episodeNumber
                }));

                const { error } = await supabase
                    .from('hidden_items')
                    .upsert(hiddenData, {
                        onConflict: 'user_id,content_id,episode_number',
                        ignoreDuplicates: false
                    });

                if (error) throw error;
            }

            console.log('[SyncService] Hidden items synced');
        } catch (error) {
            console.error('[SyncService] Failed to sync hidden items:', error);
        }
    }

    async getHiddenItems() {
        if (!this.userId) return null;

        try {
            const { data, error } = await supabase
                .from('hidden_items')
                .select('*')
                .eq('user_id', this.userId);

            if (error) throw error;

            return data.map(h => ({
                contentId: h.content_id,
                episodeNumber: h.episode_number
            }));
        } catch (error) {
            console.error('[SyncService] Failed to get hidden items:', error);
            return null;
        }
    }

    // ============================================
    // MIGRATION & BULK OPERATIONS
    // ============================================

    /**
     * Migrate all localStorage data to Supabase on first login
     */
    async migrateLocalStorageToCloud() {
        if (!this.userId) return;

        console.log('[SyncService] Starting migration from localStorage to cloud...');

        try {
            // Migrate Settings
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
            await this.syncSettings(settings);

            // Migrate Modules
            const modulesStr = localStorage.getItem('sora_modules');
            const activeModuleUrl = localStorage.getItem('active_module_url');
            if (modulesStr) {
                const modules = JSON.parse(modulesStr);
                await this.syncModules(modules, activeModuleUrl);
            }

            // Migrate Watch History
            const historyStr = localStorage.getItem('sora_watch_history');
            if (historyStr) {
                const history = JSON.parse(historyStr);
                await this.syncWatchHistory(history);
            }

            // Migrate Hidden Items
            const hiddenStr = localStorage.getItem('sora_cw_hidden');
            if (hiddenStr) {
                const hidden = JSON.parse(hiddenStr);
                await this.syncHiddenItems(hidden);
            }

            console.log('[SyncService] Migration completed successfully');
        } catch (error) {
            console.error('[SyncService] Migration failed:', error);
        }
    }

    /**
     * Pull all data from cloud and update localStorage
     */
    async pullFromCloud() {
        if (!this.userId) return;

        console.log('[SyncService] Pulling data from cloud...');

        try {
            // Pull Settings
            const settings = await this.getSettings();
            if (settings) {
                if (settings.theme_id) localStorage.setItem('themeId', settings.theme_id);
                if (settings.accent_color) localStorage.setItem('accentColor', settings.accent_color);
                if (settings.sub_size) localStorage.setItem('subSize', settings.sub_size);
                if (settings.sub_color) localStorage.setItem('subColor', settings.sub_color);
                if (settings.sub_bg_opacity) localStorage.setItem('subBgOpacity', settings.sub_bg_opacity);
                if (settings.sub_outline) localStorage.setItem('subOutline', settings.sub_outline);
                if (settings.auto_activate !== null) localStorage.setItem('autoActivate', String(settings.auto_activate));
                if (settings.auto_refetch_modules !== null) localStorage.setItem('autoRefetchModules', String(settings.auto_refetch_modules));
                if (settings.cors_proxy) localStorage.setItem('corsProxy', settings.cors_proxy);
                if (settings.use_custom_proxy !== null) localStorage.setItem('useCustomProxy', String(settings.use_custom_proxy));
            }

            // Pull Modules
            const modules = await this.getModules();
            if (modules && modules.length > 0) {
                const modulesList = modules.map(m => ({ url: m.url, name: m.name }));
                localStorage.setItem('sora_modules', JSON.stringify(modulesList));

                const activeModule = modules.find(m => m.is_active);
                if (activeModule) {
                    localStorage.setItem('active_module_url', activeModule.url);
                }
            }

            // Pull Watch History
            const history = await this.getWatchHistory();
            if (history) {
                localStorage.setItem('sora_watch_history', JSON.stringify(history));
            }

            // Pull Hidden Items
            const hidden = await this.getHiddenItems();
            if (hidden) {
                localStorage.setItem('sora_cw_hidden', JSON.stringify(hidden));
            }

            console.log('[SyncService] Cloud pull completed');
        } catch (error) {
            console.error('[SyncService] Cloud pull failed:', error);
        }
    }

    /**
     * Clear all cloud data for this user
     */
    async clearCloudData() {
        if (!this.userId) return;

        try {
            await Promise.all([
                supabase.from('user_settings').delete().eq('user_id', this.userId),
                supabase.from('user_modules').delete().eq('user_id', this.userId),
                supabase.from('watch_history').delete().eq('user_id', this.userId),
                supabase.from('hidden_items').delete().eq('user_id', this.userId)
            ]);

            console.log('[SyncService] Cloud data cleared');
        } catch (error) {
            console.error('[SyncService] Failed to clear cloud data:', error);
            throw error;
        }
    }
}

export const syncService = new SyncService();
