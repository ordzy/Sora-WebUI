import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ onClose, onAuthSuccess }) {
    const { signUp, signIn, resetPassword } = useAuth();
    const [mode, setMode] = useState('login'); // 'login', 'signup', 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                if (password.length < 6) {
                    throw new Error('Password must be at least 6 characters');
                }
                await signUp(email, password);
                setMessage('Account created successfully!');
                setTimeout(() => {
                    if (onAuthSuccess) onAuthSuccess();
                    onClose();
                }, 1000);
            } else if (mode === 'login') {
                await signIn(email, password);
                setMessage('Login successful!');
                if (onAuthSuccess) onAuthSuccess();
                setTimeout(() => onClose(), 500);
            } else if (mode === 'reset') {
                await resetPassword(email);
                setMessage('Password reset email sent! Check your inbox.');
            }
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-surface">
                    <img src="https://files.catbox.moe/in721i.png" alt="Sora" className="h-6 object-contain" />
                    <h2 className="text-2xl font-bold text-white absolute left-1/2 -translate-x-1/2">
                        {mode === 'login' && 'Welcome Back'}
                        {mode === 'signup' && 'Create Account'}
                        {mode === 'reset' && 'Reset Password'}
                    </h2>
                    <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-200 text-sm">
                            {message}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-secondary font-medium mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-accent transition-colors text-white"
                                placeholder="you@example.com"
                                required
                                autoFocus
                            />
                        </div>

                        {mode !== 'reset' && (
                            <div>
                                <label className="block text-sm text-secondary font-medium mb-2">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 pr-12 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-accent transition-colors text-white"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-white transition-colors"
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'signup' && (
                            <div>
                                <label className="block text-sm text-secondary font-medium mb-2">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 pr-12 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-accent transition-colors text-white"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-white transition-colors"
                                    >
                                        {showConfirmPassword ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent hover:bg-accent/90 text-text-on-accent font-medium py-3 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 mt-6"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                                    Processing...
                                </div>
                            ) : (
                                <>
                                    {mode === 'login' && 'Sign In'}
                                    {mode === 'signup' && 'Create Account'}
                                    {mode === 'reset' && 'Send Reset Link'}
                                </>
                            )}
                        </button>
                    </form>

                    {/* Mode Switcher */}
                    <div className="mt-6 text-center space-y-2">
                        {mode === 'login' && (
                            <>
                                <p className="text-sm text-secondary">
                                    Don't have an account?{' '}
                                    <button
                                        onClick={() => {
                                            setMode('signup');
                                            setError('');
                                            setMessage('');
                                        }}
                                        className="text-accent hover:underline font-medium"
                                    >
                                        Sign Up
                                    </button>
                                </p>
                                <p className="text-sm text-secondary">
                                    <button
                                        onClick={() => {
                                            setMode('reset');
                                            setError('');
                                            setMessage('');
                                        }}
                                        className="text-accent hover:underline font-medium"
                                    >
                                        Forgot Password?
                                    </button>
                                </p>
                            </>
                        )}
                        {mode === 'signup' && (
                            <p className="text-sm text-secondary">
                                Already have an account?{' '}
                                <button
                                    onClick={() => {
                                        setMode('login');
                                        setError('');
                                        setMessage('');
                                    }}
                                    className="text-accent hover:underline font-medium"
                                >
                                    Sign In
                                </button>
                            </p>
                        )}
                        {mode === 'reset' && (
                            <p className="text-sm text-secondary">
                                <button
                                    onClick={() => {
                                        setMode('login');
                                        setError('');
                                        setMessage('');
                                    }}
                                    className="text-accent hover:underline font-medium"
                                >
                                    Back to Sign In
                                </button>
                            </p>
                        )}
                    </div>

                    {/* Info Text */}
                    <p className="mt-6 text-xs text-secondary text-center leading-relaxed">
                        By creating an account, your settings, modules, and watch history will sync across all your devices.
                    </p>
                </div>
            </div>
        </div>
    );
}
