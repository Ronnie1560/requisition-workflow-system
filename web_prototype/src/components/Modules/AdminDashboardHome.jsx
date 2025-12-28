import React from 'react';
import { MapPin, Calculator, Users, ShoppingBag, BookOpen, Stethoscope, Building2, Package, ArrowRight, TrendingUp, DollarSign, Activity } from 'lucide-react';

const AdminDashboardHome = ({ setActiveTab, trips, partners, pastors, budgets, bibleDistributions, mercyBagEntries, impactStats }) => {
    // Calculate key metrics
    const totalBudget = budgets.reduce((sum, b) => sum + b.total, 0);
    const totalBibles = bibleDistributions.reduce((sum, entry) => sum + entry.qty, 0);
    const totalMercyBags = mercyBagEntries.reduce((sum, entry) => sum + entry.qty, 0);
    const totalPatients = impactStats.medicalOutreach.reduce((sum, record) => sum + Number(record.count), 0);

    const quickAccessCards = [
        {
            id: 'trips',
            title: 'Mission Trips',
            icon: MapPin,
            description: 'Manage trip schedules and destinations',
            count: trips.length,
            color: 'from-blue-500 to-blue-600',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-600'
        },
        {
            id: 'budgets',
            title: 'Partner Budgets',
            icon: Calculator,
            description: 'Create and manage budget allocations',
            count: budgets.length,
            color: 'from-teal-500 to-teal-600',
            bgColor: 'bg-teal-50',
            iconColor: 'text-teal-600'
        },
        {
            id: 'partners',
            title: 'Ministry Partners',
            icon: Building2,
            description: 'Manage partner organizations',
            count: partners.length,
            color: 'from-purple-500 to-purple-600',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600'
        },
        {
            id: 'pastors',
            title: 'Pastor Registry',
            icon: Users,
            description: 'Manage pastor information and CRM',
            count: pastors.length,
            color: 'from-indigo-500 to-indigo-600',
            bgColor: 'bg-indigo-50',
            iconColor: 'text-indigo-600'
        },
        {
            id: 'bibles',
            title: 'Bible Distribution',
            icon: BookOpen,
            description: 'Track Bible distributions',
            count: bibleDistributions.length,
            color: 'from-amber-500 to-amber-600',
            bgColor: 'bg-amber-50',
            iconColor: 'text-amber-600'
        },
        {
            id: 'medical',
            title: 'Medical Outreach',
            icon: Stethoscope,
            description: 'Record patient visits and outreach',
            count: impactStats.medicalOutreach.length,
            color: 'from-red-500 to-red-600',
            bgColor: 'bg-red-50',
            iconColor: 'text-red-600'
        },
        {
            id: 'mercy',
            title: 'Mercy Bags',
            icon: ShoppingBag,
            description: 'Track mercy bag distributions',
            count: mercyBagEntries.length,
            color: 'from-green-500 to-green-600',
            bgColor: 'bg-green-50',
            iconColor: 'text-green-600'
        },
        {
            id: 'items',
            title: 'Item Catalog',
            icon: Package,
            description: 'Manage budget items and costs',
            count: null,
            color: 'from-cyan-500 to-cyan-600',
            bgColor: 'bg-cyan-50',
            iconColor: 'text-cyan-600'
        },
    ];

    const statsCards = [
        { label: 'Total Budget', value: `${totalBudget.toLocaleString()} UGX`, icon: DollarSign, color: 'text-teal-600', bg: 'bg-teal-50' },
        { label: 'Bibles Distributed', value: totalBibles.toLocaleString(), icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Mercy Bags', value: totalMercyBags.toLocaleString(), icon: ShoppingBag, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Patients Served', value: totalPatients.toLocaleString(), icon: Activity, color: 'text-red-600', bg: 'bg-red-50' },
    ];

    return (
        <div className="space-y-8 page-transition">
            {/* Welcome Header */}
            <div className="bg-gradient-to-br from-primary-600 to-secondary-600 rounded-2xl p-8 text-white shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Welcome to Admin Portal</h1>
                        <p className="text-blue-100 text-lg">Manage your mission operations and track impact</p>
                    </div>
                    <div className="hidden md:block">
                        <TrendingUp className="h-20 w-20 text-white opacity-20" />
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsCards.map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Quick Access Cards */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Access</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {quickAccessCards.map((card) => (
                        <button
                            key={card.id}
                            onClick={() => setActiveTab(card.id)}
                            className="group bg-white rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-gray-100 text-left hover:scale-105"
                        >
                            <div className={`p-3 rounded-lg ${card.bgColor} inline-block mb-4 group-hover:scale-110 transition-transform`}>
                                <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center justify-between">
                                {card.title}
                                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">{card.description}</p>
                            {card.count !== null && (
                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    <span className="text-xs text-gray-500">Total Records</span>
                                    <span className="text-sm font-bold text-gray-900">{card.count}</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Recent Activity Section (Optional) */}
            <div className="bg-white rounded-xl p-6 shadow-card border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Getting Started</h2>
                <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">Set up Mission Trips</p>
                            <p className="text-xs text-gray-500">Create your first mission trip to get started</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">Add Ministry Partners</p>
                            <p className="text-xs text-gray-500">Register organizations you work with</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">3</div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">Create Budgets</p>
                            <p className="text-xs text-gray-500">Allocate resources for each partner and trip</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboardHome;
