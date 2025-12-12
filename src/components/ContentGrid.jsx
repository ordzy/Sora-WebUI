import React from 'react';

const ContentGrid = ({ content, onSelect }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {content.map((item, index) => (
                <div
                    key={item.id}
                    className="group relative cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-1 animate-fadeIn"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => onSelect(item)}
                >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent group-hover:border-accent shadow-lg group-hover:shadow-accent/20 transition-all duration-300">
                        {item.poster && (
                            <img
                                src={item.poster}
                                alt={item.title}
                                className="w-full h-full object-cover"
                            />
                        )}
                        {!item.poster && (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <span className="text-gray-600 text-4xl">🎬</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-4">
                            <h3 className="text-white font-semibold text-sm line-clamp-2">{item.title}</h3>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ContentGrid;
