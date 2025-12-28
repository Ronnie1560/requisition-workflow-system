import React from 'react';

const colorSchemes = {
    primary: {
        bg: 'from-blue-50 to-blue-100',
        bgHover: 'group-hover:from-blue-100 group-hover:to-blue-200',
        icon: 'text-blue-600',
        text: 'group-hover:text-blue-600',
        border: 'hover:border-blue-200',
        bar: 'from-blue-400 via-blue-500 to-blue-600'
    },
    secondary: {
        bg: 'from-teal-50 to-teal-100',
        bgHover: 'group-hover:from-teal-100 group-hover:to-teal-200',
        icon: 'text-teal-600',
        text: 'group-hover:text-teal-600',
        border: 'hover:border-teal-200',
        bar: 'from-teal-400 via-teal-500 to-teal-600'
    },
    purple: {
        bg: 'from-purple-50 to-purple-100',
        bgHover: 'group-hover:from-purple-100 group-hover:to-purple-200',
        icon: 'text-purple-600',
        text: 'group-hover:text-purple-600',
        border: 'hover:border-purple-200',
        bar: 'from-purple-400 via-purple-500 to-purple-600'
    },
    pink: {
        bg: 'from-pink-50 to-pink-100',
        bgHover: 'group-hover:from-pink-100 group-hover:to-pink-200',
        icon: 'text-pink-600',
        text: 'group-hover:text-pink-600',
        border: 'hover:border-pink-200',
        bar: 'from-pink-400 via-pink-500 to-pink-600'
    }
};

const ImpactCard = ({ title, value, icon: Icon, colorScheme = 'primary' }) => {
    const colors = colorSchemes[colorScheme] || colorSchemes.primary;

    return (
        <div className={`group bg-gradient-to-br from-white to-gray-50 overflow-hidden shadow-card hover:shadow-card-hover rounded-xl border border-gray-100 ${colors.border} transition-all duration-300 cursor-pointer transform hover:-translate-y-1`}>
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</dt>
                        <dd>
                            <div className={`text-3xl font-bold text-gray-900 ${colors.text} transition-colors`}>{value}</div>
                        </dd>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                        <div className={`p-4 rounded-2xl bg-gradient-to-br ${colors.bg} ${colors.bgHover} transition-all duration-300 group-hover:scale-110 shadow-md`}>
                            <Icon className={`h-7 w-7 ${colors.icon}`} />
                        </div>
                    </div>
                </div>
            </div>
            <div className={`h-1 bg-gradient-to-r ${colors.bar} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`}></div>
        </div>
    );
};

export default ImpactCard;
