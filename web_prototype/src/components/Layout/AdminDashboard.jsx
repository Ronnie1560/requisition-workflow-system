import React from 'react';
import { MapPin, Calculator, Users, ShoppingBag, BarChart, Lock, Info, Stethoscope, BookOpen, Building2, Package, Home } from 'lucide-react';
import Breadcrumb from '../UI/Breadcrumb';

const AdminDashboard = ({ activeTab, setActiveTab, children }) => {
    const navItems = [
        { id: 'home', label: 'Dashboard', icon: Home },
        { id: 'trips', label: 'Mission Trips', icon: MapPin },
        { id: 'budgets', label: 'Partner Budgets', icon: Calculator },
        { id: 'items', label: 'Item Catalog', icon: Package },
        { id: 'partners', label: 'Ministry Partners', icon: Building2 },
        { id: 'pastors', label: 'Pastor Registry', icon: Users },
        { id: 'bibles', label: 'Bible Distribution', icon: BookOpen },
        { id: 'mercy', label: 'Mercy Bags', icon: ShoppingBag },
        { id: 'medical', label: 'Medical Outreach', icon: Stethoscope },
        { id: 'reports', label: 'Financial Reports', icon: BarChart },
        { id: 'settings', label: 'Settings', icon: Lock },
    ];

    // Get breadcrumb items based on active tab
    const getBreadcrumbItems = () => {
        if (activeTab === 'home') return [];
        const currentItem = navItems.find(item => item.id === activeTab);
        return currentItem ? [{ id: activeTab, label: currentItem.label }] : [];
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col lg:flex-row gap-8">
                <aside className="w-full lg:w-64 flex-shrink-0">
                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center px-4 py-3.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${activeTab === item.id ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-200 scale-105' : 'text-gray-600 hover:bg-white hover:shadow-md hover:scale-102'}`}
                            >
                                <div className={`mr-3 p-1.5 rounded-lg ${activeTab === item.id ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-primary-50'}`}>
                                    <item.icon className={`h-5 w-5 ${activeTab === item.id ? 'text-white' : 'text-gray-500 group-hover:text-primary-600'}`} />
                                </div>
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    {activeTab !== 'home' && (
                        <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200 shadow-sm">
                            <h4 className="text-sm font-bold text-blue-900 flex items-center">
                                <div className="p-1 bg-blue-200 rounded-lg mr-2">
                                    <Info className="h-4 w-4 text-blue-700" />
                                </div>
                                Pro Tip
                            </h4>
                            <p className="text-xs text-blue-700 mt-2 leading-relaxed">Navigate back to Dashboard for an overview of all your mission data.</p>
                        </div>
                    )}
                </aside>
                <main className="flex-1 min-w-0 full-height-content">
                    {activeTab !== 'home' && (
                        <Breadcrumb items={getBreadcrumbItems()} onNavigate={setActiveTab} />
                    )}
                    <div key={activeTab} className="page-transition">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
