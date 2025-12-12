import React, { useState, useEffect, useRef } from 'react';
import { themes } from '../constants/themes';

const AppSettings = ({ onClose, onResetModules }) => {
    const [selectedThemeId, setSelectedThemeId] = useState(localStorage.getItem('themeId') || 'white');
    const [autoActivate, setAutoActivate] = useState(localStorage.getItem('autoActivate') !== 'false'); // Default true
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [proxyUrl, setProxyUrl] = useState(localStorage.getItem('corsProxy') || '');
    const [useCustomProxy, setUseCustomProxy] = useState(localStorage.getItem('useCustomProxy') === 'true'); // Default false, only true if localStorage says so ('true')
    const [autoRefetchModules, setAutoRefetchModules] = useState(localStorage.getItem('autoRefetchModules') !== 'false'); // Default true
    // Removed isColorDropdownOpen state as we use grid now

    // Subtitle Settings
    // Subtitle Settings
    const [subSettings, setSubSettings] = useState({
        size: localStorage.getItem('subSize') || '100%',
        color: localStorage.getItem('subColor') || '#ffffff',
        bgOpacity: localStorage.getItem('subBgOpacity') || '0.5', // 0 to 1
        outline: localStorage.getItem('subOutline') || 'none',
    });

    // UI states for dropdowns
    const [isBgDropdownOpen, setIsBgDropdownOpen] = useState(false);
    const [isOutlineDropdownOpen, setIsOutlineDropdownOpen] = useState(false);
    const bgDropdownRef = useRef(null);
    const outlineDropdownRef = useRef(null);

    // Removed accentColors array definition as it's imported

    const subSizes = [
        { name: 'Small', value: '75%' },
        { name: 'Normal', value: '100%' },
        { name: 'Large', value: '125%' },
        { name: 'Extra Large', value: '150%' },
    ];

    const subColors = [
        { name: 'White', value: '#ffffff' },
        { name: 'Yellow', value: '#ffff00' },
        { name: 'Cyan', value: '#00ffff' },
        { name: 'Green', value: '#00ff00' },
    ];

    const subBgs = [
        { name: 'Black (50%)', value: 'rgba(0,0,0,0.5)' },
        { name: 'Black (75%)', value: 'rgba(0,0,0,0.75)' },
        { name: 'Black (100%)', value: 'rgba(0,0,0,1)' },
        { name: 'None', value: 'transparent' },
    ];

    const subOutlines = [
        { name: 'None', value: 'none' },
        { name: 'Outline', value: 'outline' },
    ];

    // Load saved settings
    useEffect(() => {
        // Theme loading is handled in App.jsx mostly, but we sync local state here
        const savedThemeId = localStorage.getItem('themeId');
        if (savedThemeId) {
            setSelectedThemeId(savedThemeId);
        }

        const savedProxy = localStorage.getItem('corsProxy');
        if (savedProxy) {
            setProxyUrl(savedProxy);
        }
        setUseCustomProxy(localStorage.getItem('useCustomProxy') === 'true');
        // Auto activate defaults to true, so no need to set if null, but if it exists in local storage we respect it
        if (localStorage.getItem('autoActivate') !== null) {
            setAutoActivate(localStorage.getItem('autoActivate') === 'true');
        }

        // Close dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsColorDropdownOpen(false);
            }
            if (outlineDropdownRef.current && !outlineDropdownRef.current.contains(event.target)) {
                setIsOutlineDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleThemeChange = (themeId) => {
        const theme = themes.find(t => t.id === themeId);
        if (!theme) return;

        setSelectedThemeId(themeId);
        document.documentElement.style.setProperty('--color-accent', theme.colors.primary);
        document.documentElement.style.setProperty('--color-text-on-accent', theme.colors.text);
        document.documentElement.style.setProperty('--color-secondary-element', theme.colors.secondary);

        localStorage.setItem('themeId', themeId);
        localStorage.setItem('accentColor', theme.colors.primary); // Keep for legacy/compatibility if needed
    };

    const handleSubSettingChange = (key, value) => {
        const newSettings = { ...subSettings, [key]: value };
        setSubSettings(newSettings);
        localStorage.setItem(key === 'bgOpacity' ? 'subBgOpacity' : `sub${key.charAt(0).toUpperCase() + key.slice(1)}`, value);
        // Dispatch event for specialized listeners
        window.dispatchEvent(new Event('subtitle-settings-changed'));
    };

    const handleResetModules = () => {
        if (showResetConfirm) {
            onResetModules();
            setShowResetConfirm(false);
            onClose();
        } else {
            setShowResetConfirm(true);
        }
    };

    const handleAutoActivateChange = (checked) => {
        setAutoActivate(checked);
        localStorage.setItem('autoActivate', checked);
    };

    return (
        <div className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-surface sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <h2 className="text-2xl font-bold text-white">Settings</h2>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Appearance Section */}
                        <div>
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                Appearance
                            </h3>
                            <div>
                                <label className="text-secondary text-sm block mb-2">Accent Color</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {themes.map((theme) => (
                                        <button
                                            key={theme.id}
                                            onClick={() => handleThemeChange(theme.id)}
                                            className={`h-10 rounded-lg border transition-all relative overflow-hidden ${selectedThemeId === theme.id
                                                ? 'border-white ring-2 ring-white/20 scale-105'
                                                : 'border-white/10 hover:border-white/50'
                                                }`}
                                            style={{ backgroundColor: theme.colors.primary }}
                                            title={theme.name}
                                        >
                                            {selectedThemeId === theme.id && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <svg className="w-5 h-5" style={{ color: theme.colors.text }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Modules Settings - moved under Appearance */}
                            <div className="mt-6">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    Modules
                                </h3>
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={autoActivate}
                                                onChange={(e) => handleAutoActivateChange(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${autoActivate ? 'bg-accent' : 'bg-white/10'}`}></div>
                                            <div className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-200 ${autoActivate ? 'translate-x-4 bg-[var(--color-text-on-accent)]' : 'bg-white'}`}></div>
                                        </div>
                                        <span className="text-white text-sm group-hover:text-accent transition-colors">Auto-activate new modules</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Network */}
                        <div className="space-y-8">
                            {/* Network Settings */}
                            <div>
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    Network
                                </h3>
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={useCustomProxy}
                                                onChange={(e) => {
                                                    setUseCustomProxy(e.target.checked);
                                                    localStorage.setItem('useCustomProxy', e.target.checked);
                                                }}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${useCustomProxy ? 'bg-accent' : 'bg-white/10'}`}></div>
                                            <div className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-200 ${useCustomProxy ? 'translate-x-4 bg-[var(--color-text-on-accent)]' : 'bg-white'}`}></div>
                                        </div>
                                        <span className="text-white text-sm group-hover:text-accent transition-colors">Use external CORS proxy</span>
                                    </label>

                                    <div>
                                        <label className={`text-sm block mb-2 transition-colors ${useCustomProxy ? 'text-secondary' : 'text-secondary/50'}`}>Proxy URL</label>
                                        <input
                                            type="text"
                                            value={proxyUrl}
                                            onChange={(e) => {
                                                setProxyUrl(e.target.value);
                                                localStorage.setItem('corsProxy', e.target.value);
                                            }}
                                            disabled={!useCustomProxy}
                                            onBlur={() => window.location.reload()}
                                            placeholder="https://corsproxy.io/?"
                                            className={`w-full bg-black/50 border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent placeholder-secondary/30 transition-all font-mono text-sm
                                                    ${useCustomProxy ? 'border-white/10 opacity-100' : 'border-white/5 opacity-50 cursor-not-allowed'}`}
                                        />
                                        <p className={`text-xs mt-1 transition-colors ${useCustomProxy ? 'text-secondary/60' : 'text-secondary/30'}`}>
                                            Default: corsproxy.io (Standard)
                                        </p>
                                    </div>

                                    <label className="flex items-center gap-3 cursor-pointer group mt-6">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={autoRefetchModules}
                                                onChange={(e) => {
                                                    setAutoRefetchModules(e.target.checked);
                                                    localStorage.setItem('autoRefetchModules', e.target.checked);
                                                }}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${autoRefetchModules ? 'bg-accent' : 'bg-white/10'}`}></div>
                                            <div className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-200 ${autoRefetchModules ? 'translate-x-4 bg-[var(--color-text-on-accent)]' : 'bg-white'}`}></div>
                                        </div>
                                        <span className="text-white text-sm group-hover:text-accent transition-colors">Auto-update modules on launch</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-white/10" />

                {/* Captions Section */}
                <div className="p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        Captions
                        <span className="text-xs bg-white/10 text-secondary px-2 py-0.5 rounded ml-2">Applies to native tracks</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Controls */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-secondary text-sm block mb-2">Size</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {subSizes.map(size => (
                                        <button
                                            key={size.value}
                                            onClick={() => handleSubSettingChange('size', size.value)}
                                            className={`px-2 py-2 rounded text-xs border transition-colors ${subSettings.size === size.value
                                                ? 'bg-accent border-accent'
                                                : 'bg-black/50 border-white/10 text-white hover:bg-white/10'
                                                }`}
                                            style={subSettings.size === size.value ? { color: 'var(--color-text-on-accent)' } : {}}
                                        >
                                            {size.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-secondary text-sm block mb-2">Color</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {subColors.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => handleSubSettingChange('color', color.value)}
                                            className={`h-10 rounded-lg border transition-all relative overflow-hidden ${subSettings.color === color.value
                                                ? 'border-white ring-2 ring-white/20 scale-105'
                                                : 'border-white/10 hover:border-white/50'
                                                }`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        >
                                            {subSettings.color === color.value && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-secondary text-sm block mb-2">Background Opacity</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={subSettings.bgOpacity}
                                        onChange={(e) => handleSubSettingChange('bgOpacity', e.target.value)}
                                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                                    />
                                    <span className="text-white text-sm w-8">
                                        {Math.round(subSettings.bgOpacity * 100)}%
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-secondary text-sm block mb-2">Text Outline</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleSubSettingChange('outline', 'none')}
                                        className={`flex-1 text-xs py-2.5 px-3 rounded border transition-colors ${subSettings.outline === 'none'
                                            ? 'bg-accent border-accent'
                                            : 'border-white/10 text-white hover:bg-white/10'}`}
                                        style={subSettings.outline === 'none' ? { color: 'var(--color-text-on-accent)' } : {}}
                                    >
                                        Off
                                    </button>
                                    <button
                                        onClick={() => handleSubSettingChange('outline', 'outline')}
                                        className={`flex-1 text-xs py-2.5 px-3 rounded border transition-colors ${subSettings.outline === 'outline'
                                            ? 'bg-accent border-accent'
                                            : 'border-white/10 text-white hover:bg-white/10'}`}
                                        style={subSettings.outline === 'outline' ? { color: 'var(--color-text-on-accent)' } : {}}
                                    >
                                        On
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div>
                            <label className="text-secondary text-sm block mb-2">Preview</label>
                            <div className="aspect-video bg-gray-800 rounded-lg relative overflow-hidden flex items-end justify-center pb-4 bg-[url('https://files.catbox.moe/ofdc4l.png')] bg-cover bg-center">
                                <div className="absolute inset-0 bg-black/40"></div>
                                <div className="relative text-center px-4 py-1 rounded transition-all duration-300" style={{
                                    color: subSettings.color,
                                    backgroundColor: `rgba(0,0,0,${subSettings.bgOpacity})`,
                                    fontSize: subSettings.size === '100%' ? '16px' : subSettings.size === '75%' ? '12px' : subSettings.size === '125%' ? '20px' : '24px',
                                    textShadow: subSettings.outline === 'outline' ? '0px 0px 6px #000, 0px 0px 8px #000' : 'none',
                                    // Simple mapping for preview, actual video uses percentages
                                }}>
                                    Sample Caption Text
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-white/10" />

                {/* Danger Zone */}
                <div className="p-6">
                    <h3 className="text-white font-semibold mb-2">Danger Zone</h3>
                    <p className="text-secondary text-sm mb-3">
                        This will remove all loaded modules. This action cannot be undone.
                    </p>
                    {showResetConfirm ? (
                        <div className="space-y-2">
                            <p className="text-red-400 text-sm font-semibold">
                                Are you sure? This will delete all modules.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleResetModules}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                                >
                                    Yes, Reset All
                                </button>
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleResetModules}
                            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg transition-colors font-medium border border-red-500/20"
                        >
                            Reset All Modules
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AppSettings;
