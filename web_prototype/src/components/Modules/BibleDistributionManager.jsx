import React, { useState } from 'react';
import { BookOpen, Save, Lock, Calendar, MapPin } from 'lucide-react';
import { useToast } from '../UI/ToastProvider';

const BibleDistributionManager = ({ trips, partners, bibleDistributions, setBibleDistributions }) => {
    const toast = useToast();
    const [selectedTrip, setSelectedTrip] = useState(trips[0]?.id);
    const [selectedPartner, setSelectedPartner] = useState(partners[0]?.id);
    const [location, setLocation] = useState('');
    const [quantity, setQuantity] = useState('');
    const [distributionDate, setDistributionDate] = useState('');

    const handleSave = () => {
        // Validation
        if (!quantity || Number(quantity) <= 0) {
            toast.error("Please enter a valid quantity.");
            return;
        }
        if (!location || location.trim() === '') {
            toast.error("Please enter a location.");
            return;
        }
        if (!distributionDate) {
            toast.error("Please select a distribution date.");
            return;
        }

        const newEntry = {
            id: Date.now(),
            tripId: selectedTrip,
            partnerId: selectedPartner,
            location: location.trim(),
            qty: Number(quantity),
            date: distributionDate,
            savedAt: new Date().toLocaleDateString()
        };

        setBibleDistributions([newEntry, ...bibleDistributions]);

        // Reset form
        setQuantity('');
        setLocation('');
        setDistributionDate('');
        toast.success("Bible distribution recorded successfully!");
    };

    const getTripName = (id) => trips.find(t => t.id === id)?.name || id;
    const getPartnerName = (id) => partners.find(p => p.id === id)?.name || id;

    const totalBibles = bibleDistributions.reduce((acc, entry) => acc + entry.qty, 0);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Summary Header */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <BookOpen className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Bible Distribution</h2>
                            <p className="text-sm text-gray-600">Track Bible distributions across missions</p>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-white rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Bibles</p>
                                <p className="text-3xl font-bold text-primary mt-1">{totalBibles.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-primary-50 rounded-lg">
                                <BookOpen className="h-6 w-6 text-primary-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Distributions</p>
                                <p className="text-3xl font-bold text-secondary mt-1">{bibleDistributions.length}</p>
                            </div>
                            <div className="p-3 bg-secondary-50 rounded-lg">
                                <MapPin className="h-6 w-6 text-secondary-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg per Location</p>
                                <p className="text-3xl font-bold text-teal-600 mt-1">
                                    {bibleDistributions.length > 0
                                        ? Math.round(totalBibles / bibleDistributions.length)
                                        : 0}
                                </p>
                            </div>
                            <div className="p-3 bg-teal-50 rounded-lg">
                                <BookOpen className="h-6 w-6 text-teal-600" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Input Form */}
            <div className="bg-white p-6 rounded-lg shadow-card border border-gray-200 border-t-4 border-t-primary">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Register Bible Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mission Trip *</label>
                        <select
                            value={selectedTrip}
                            onChange={(e) => setSelectedTrip(e.target.value)}
                            className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]"
                        >
                            {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ministry Partner *</label>
                        <select
                            value={selectedPartner}
                            onChange={(e) => setSelectedPartner(e.target.value)}
                            className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]"
                        >
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Distribution Date *</label>
                        <input
                            type="date"
                            className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            value={distributionDate}
                            onChange={(e) => setDistributionDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                        <input
                            type="text"
                            className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., Jinja Church, Kampala Center"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                        <input
                            type="number"
                            className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g. 50"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min="1"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        className="btn btn-primary flex items-center"
                    >
                        <Save className="h-4 w-4 mr-2" /> Save Entry
                    </button>
                </div>
            </div>

            {/* Distribution Log Table */}
            <div className="bg-white shadow-card rounded-lg overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-[#FAFAFA] flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Bible Distribution Log</h3>
                    <span className="text-xs text-gray-500 flex items-center">
                        <Lock className="h-3 w-3 mr-1" /> Entries are locked upon saving
                    </span>
                </div>
                <div className="overflow-x-auto table-container">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Date Saved</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Distribution Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Mission Trip</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Partner</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {bibleDistributions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500 italic">
                                        No Bible distributions recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                bibleDistributions.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{entry.savedAt}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 flex items-center">
                                            <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                                            {entry.date}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{getTripName(entry.tripId)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{getPartnerName(entry.partnerId)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 flex items-center">
                                            <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                                            {entry.location}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-primary">{entry.qty}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="badge badge-neutral">
                                                <Lock className="h-3 w-3 mr-1" /> Locked
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BibleDistributionManager;
