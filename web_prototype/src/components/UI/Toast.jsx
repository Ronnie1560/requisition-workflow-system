import React from 'react';
import { CheckCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => (
    <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 transition-all transform duration-300 z-50 ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
        {type === 'success' ? <CheckCircle className="h-5 w-5" /> : <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
        <span className="font-medium text-sm">{message}</span>
        <button onClick={onClose} className="ml-auto hover:text-gray-200"><X className="h-4 w-4" /></button>
    </div>
);

export default Toast;
