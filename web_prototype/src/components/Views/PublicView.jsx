import React, { useState, useMemo } from 'react';
import { Heart, Users, BookOpen, ShoppingBag, Stethoscope, Calendar, MapPin, Phone, Mail, Church } from 'lucide-react';
import ImpactCard from '../UI/ImpactCard';

const PublicView = ({ pastors, bibleDistributions, medicalOutreachStats, partners, trips, mercyBagEntries }) => {
    const [selectedTripFilter, setSelectedTripFilter] = useState('all');

    // Filter medical outreach by trip
    const filteredMedicalOutreach = useMemo(() => {
        if (selectedTripFilter === 'all') return medicalOutreachStats;
        return medicalOutreachStats.filter(m => m.tripId === selectedTripFilter);
    }, [medicalOutreachStats, selectedTripFilter]);

    // Filter pastors by trip
    const filteredPastors = useMemo(() => {
        if (selectedTripFilter === 'all') return pastors;
        return pastors.filter(p => p.tripId === selectedTripFilter);
    }, [pastors, selectedTripFilter]);

    // Filter Bible distributions by trip
    const filteredBibles = useMemo(() => {
        if (selectedTripFilter === 'all') return bibleDistributions.reduce((acc, curr) => acc + curr.qty, 0);
        return bibleDistributions.filter(e => e.tripId === selectedTripFilter).reduce((acc, curr) => acc + curr.qty, 0);
    }, [bibleDistributions, selectedTripFilter]);

    // Filter mercy bags by trip
    const filteredMercyBags = useMemo(() => {
        if (selectedTripFilter === 'all') return mercyBagEntries.reduce((acc, curr) => acc + curr.qty, 0);
        return mercyBagEntries.filter(e => e.tripId === selectedTripFilter).reduce((acc, curr) => acc + curr.qty, 0);
    }, [mercyBagEntries, selectedTripFilter]);

    // Calculate lives touched from filtered data
    const calculatedLivesTouched = useMemo(() => {
        const pastorCount = filteredPastors ? filteredPastors.length : 0;
        const medicalCount = filteredMedicalOutreach.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);
        return pastorCount + medicalCount + filteredMercyBags;
    }, [filteredPastors, filteredMedicalOutreach, filteredMercyBags]);


    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="text-center md:text-left mb-4 md:mb-0">
                    <h1 className="text-3xl font-bold text-slate-800">Mission Impact Report</h1>
                    <p className="mt-2 text-slate-600">Tracking our outreach and resource distribution across Uganda.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-600">Filter by Trip:</span>
                    <select value={selectedTripFilter} onChange={(e) => setSelectedTripFilter(e.target.value)} className="block w-48 border border-gray-300 rounded-md p-2 text-sm focus:ring-primary focus:border-primary">
                        <option value="all">All Missions</option>
                        {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ImpactCard title="Lives Touched" value={`${calculatedLivesTouched}+`} icon={Heart} colorScheme="pink" />
                <ImpactCard title="Pastors Trained" value={filteredPastors ? filteredPastors.length : 0} icon={Users} colorScheme="primary" />
                <ImpactCard title="Bibles Distributed" value={filteredBibles} icon={BookOpen} colorScheme="purple" />
                <ImpactCard title="Mercy Bags" value={filteredMercyBags} icon={ShoppingBag} colorScheme="secondary" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md mr-3">
                        <Heart className="h-5 w-5 text-white" />
                    </div>
                    Our Ministry Partners
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {partners.filter(p => p.type !== 'Logistics').map(partner => (
                        <div key={partner.id} className="group bg-gradient-to-br from-white via-purple-50/20 to-pink-50/20 rounded-2xl shadow-card hover:shadow-card-hover p-6 border border-purple-100 hover:border-purple-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300">
                                    <Heart className="h-6 w-6 text-white" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4 group-hover:text-purple-600 transition-colors">{partner.name}</h3>
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Programs Supported</p>
                                <div className="flex flex-wrap gap-2">
                                    {partner.programs && partner.programs.length > 0 ? partner.programs.map(prog => (
                                        <span key={prog} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary-50 to-teal-50 text-primary-700 border border-primary-200 group-hover:from-primary-100 group-hover:to-teal-100 transition-all">{prog}</span>
                                    )) : <span className="text-xs text-gray-400 italic">General Ministry Support</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md mr-3">
                        <Church className="h-5 w-5 text-white" />
                    </div>
                    Pastors & Church Leaders Trained
                </h2>
                {!filteredPastors || filteredPastors.length === 0 ? (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center border border-gray-200">
                        <Church className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 italic">No pastor records for selected trip.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPastors.map((pastor) => (
                            <div key={pastor.id} className="group bg-gradient-to-br from-white via-blue-50/30 to-primary-50/30 rounded-2xl shadow-card hover:shadow-card-hover p-6 border border-blue-100 hover:border-blue-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300">
                                        <Users className="h-6 w-6 text-white" />
                                    </div>
                                    {pastor.status && (
                                        <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md">
                                            {pastor.status}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                                    {pastor.name}
                                </h3>
                                {pastor.church && (
                                    <div className="flex items-center text-sm text-gray-600 mb-2">
                                        <Church className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                                        <span className="font-medium truncate">{pastor.church}</span>
                                    </div>
                                )}
                                {pastor.location && (
                                    <div className="flex items-center text-sm text-gray-600 mb-2">
                                        <MapPin className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                                        <span className="truncate">{pastor.location}</span>
                                    </div>
                                )}
                                {pastor.phone && (
                                    <div className="flex items-center text-sm text-gray-600 mb-2">
                                        <Phone className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                                        <span className="truncate">{pastor.phone}</span>
                                    </div>
                                )}
                                {pastor.email && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Mail className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                                        <span className="truncate text-xs">{pastor.email}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                    <div className="p-2 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-md mr-3">
                        <Stethoscope className="h-5 w-5 text-white" />
                    </div>
                    Medical & Malnutrition Outreach Impact
                </h2>
                {filteredMedicalOutreach.length === 0 ? (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center border border-gray-200">
                        <Stethoscope className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 italic">No medical outreach records for selected trip.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMedicalOutreach.map((stat, idx) => (
                            <div key={idx} className="group bg-gradient-to-br from-white via-teal-50/30 to-blue-50/30 rounded-2xl shadow-card hover:shadow-card-hover p-6 border border-teal-100 hover:border-teal-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300">
                                        <MapPin className="h-6 w-6 text-white" />
                                    </div>
                                    <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-primary-500 to-teal-500 text-white shadow-md">
                                        {stat.count} Patients
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-teal-600 transition-colors">
                                    {stat.location}
                                </h3>
                                <div className="flex items-center text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200">
                                    <Calendar className="h-4 w-4 text-teal-500 mr-2" />
                                    <span className="font-medium">{stat.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicView;
