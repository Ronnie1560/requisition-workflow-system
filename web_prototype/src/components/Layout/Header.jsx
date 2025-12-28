import React from 'react';
import { Globe, LayoutDashboard, Lock, Wifi, WifiOff } from 'lucide-react';

const Header = ({ activeView, setActiveView, isOffline, setIsOffline }) => (
    <header className="bg-gradient-to-r from-secondary-600 to-secondary-500 text-white shadow-lg sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveView('public')}>
                    <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-all duration-200">
                        <Globe className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-xl tracking-tight leading-none">FBCC Missions</span>
                        <span className="text-[10px] text-blue-100 leading-none font-medium">Trip Manager v1.0</span>
                    </div>
                </div>
                <div className="hidden md:flex space-x-3">
                    <button onClick={() => setActiveView('public')} className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeView === 'public' ? 'bg-white text-secondary-600 shadow-lg scale-105' : 'text-blue-50 hover:bg-white/10 hover:scale-105'}`}>
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Public Impact</span>
                    </button>
                    <button onClick={() => setActiveView('admin')} className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeView === 'admin' ? 'bg-white text-secondary-600 shadow-lg scale-105' : 'text-blue-50 hover:bg-white/10 hover:scale-105'}`}>
                        <Lock className="h-4 w-4" />
                        <span>Admin Portal</span>
                    </button>
                </div>
                <div className="flex items-center space-x-2 text-xs cursor-pointer bg-black/20 px-3 py-2 rounded-full border border-white/30 hover:bg-black/30 hover:border-white/40 transition-all duration-200 hover:scale-105" onClick={() => setIsOffline(!isOffline)} title="Toggle Connection Simulation">
                    {isOffline ? <WifiOff className="h-4 w-4 text-red-200" /> : <Wifi className="h-4 w-4 text-green-300" />}
                    <span className={isOffline ? "text-red-200 font-semibold" : "text-green-200 font-semibold"}>{isOffline ? "Offline Mode" : "Online"}</span>
                </div>
            </div>
        </div>
        <div className="md:hidden flex bg-secondary-600/90 border-t border-white/10">
            <button onClick={() => setActiveView('public')} className={`flex-1 py-3 text-center text-sm font-semibold transition-all ${activeView === 'public' ? 'text-white bg-white/20 border-b-2 border-white' : 'text-blue-100'}`}>Public</button>
            <button onClick={() => setActiveView('admin')} className={`flex-1 py-3 text-center text-sm font-semibold transition-all ${activeView === 'admin' ? 'text-white bg-white/20 border-b-2 border-white' : 'text-blue-100'}`}>Admin</button>
        </div>
    </header>
);

export default Header;
