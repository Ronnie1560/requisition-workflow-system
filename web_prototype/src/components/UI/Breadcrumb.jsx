import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumb = ({ items, onNavigate }) => {
    return (
        <nav className="flex items-center space-x-2 text-sm mb-6">
            <button
                onClick={() => onNavigate('home')}
                className="flex items-center text-gray-500 hover:text-primary transition-colors"
            >
                <Home className="h-4 w-4" />
            </button>
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    {index === items.length - 1 ? (
                        <span className="font-medium text-gray-900">{item.label}</span>
                    ) : (
                        <button
                            onClick={() => onNavigate(item.id)}
                            className="text-gray-500 hover:text-primary transition-colors"
                        >
                            {item.label}
                        </button>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};

export default Breadcrumb;
