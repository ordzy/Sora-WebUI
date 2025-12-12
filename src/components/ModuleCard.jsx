import React from 'react';

const ModuleCard = ({ module }) => {
    return (
        <div className="bg-surface rounded-xl p-4 border border-transparent hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10 group cursor-pointer flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <img
                        src={module.icon}
                        alt={module.name}
                        className="w-12 h-12 rounded-lg object-cover bg-black border border-white/10"
                    />
                    <div>
                        <h3 className="text-lg font-semibold text-primary group-hover:text-accent transition-colors">{module.name}</h3>
                        <p className="text-xs text-secondary">{module.author}</p>
                    </div>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-white/5 text-secondary rounded-md border border-white/5">
                    {module.type}
                </span>
            </div>

            <p className="text-sm text-secondary mb-6 flex-grow line-clamp-2">
                {module.description}
            </p>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                <span className="text-xs text-secondary/70">v{module.version}</span>
                <button className="px-4 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors shadow-sm hover:shadow-md">
                    Install
                </button>
            </div>
        </div>
    );
};

export default ModuleCard;
