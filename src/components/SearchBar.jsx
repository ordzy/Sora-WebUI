import React from 'react';

const SearchBar = ({ value, onChange, autoFocus = false }) => {
    return (
        <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-surface rounded-xl leading-5 bg-surface text-primary placeholder-secondary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent sm:text-sm transition-all duration-300 shadow-lg"
                placeholder="Type here to search..."
                value={value}
                onChange={onChange}
                autoFocus={autoFocus}
            />
        </div>
    );
};

export default SearchBar;
