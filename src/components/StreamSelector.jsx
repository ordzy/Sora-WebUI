import React from 'react';

const StreamSelector = ({ streams, onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-accent/20 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-primary">Select Stream</h2>
                    <button
                        onClick={onClose}
                        className="text-secondary hover:text-primary transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>


                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {streams.map((stream, index) => (
                        <button
                            key={index}
                            onClick={() => onSelect(stream)}
                            className="w-full text-left px-6 py-4 bg-background border border-surface hover:border-accent rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-accent/10 group"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-medium text-primary group-hover:text-accent transition-colors">
                                    {stream.label}
                                </span>
                                <svg className="w-5 h-5 text-secondary group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    ))}
                </div>

                {streams.length === 0 && (
                    <div className="text-center py-8 text-secondary">
                        No streams available
                    </div>
                )}
            </div>
        </div>
    );
};

export default StreamSelector;
