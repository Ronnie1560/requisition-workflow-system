import React, { useState } from 'react';
import { Save, Lock } from 'lucide-react';
import { useToast } from '../UI/ToastProvider';

const MercyBagManager = ({ trips, partners, mercyBagEntries, setMercyBagEntries }) => {
    const toast = useToast();
    const [selectedTrip, setSelectedTrip] = useState(trips[0]?.id);
    const [selectedPartner, setSelectedPartner] = useState(partners[0]?.id);
    const [quantity, setQuantity] = useState('');

    const handleSave = () => {
        // Enhanced validation
        if (!quantity || quantity.trim() === '') {
            toast.error("Please enter a quantity.");
            return;
        }
        if (Number(quantity) <= 0) {
            toast.error("Quantity must be greater than 0.");
            return;
        }
        if (Number(quantity) > 10000) {
            if (!window.confirm("You entered a very high quantity. Are you sure this is correct?")) {
                return;
            }
        }
        if (!selectedTrip) {
            toast.error("Please select a mission trip.");
            return;
        }
        if (!selectedPartner) {
            toast.error("Please select a ministry partner.");
            return;
        }

        const newEntry = {
            id: Date.now(),
            tripId: selectedTrip,
            partnerId: selectedPartner,
            qty: Number(quantity),
            savedAt: new Date().toLocaleDateString()
        };

        setMercyBagEntries([newEntry, ...mercyBagEntries]);
        setQuantity('');
        toast.success("Mercy bag distribution recorded successfully!");
    };

    const getTripName = (id) => trips.find(t => t.id === id)?.name || id;
    const getPartnerName = (id) => partners.find(p => p.id === id)?.name || id;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-t-4 border-t-primary card-shadow">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Register Mercy Bags Distributed</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mission Trip *</label>
                        <select value={selectedTrip} onChange={(e) => setSelectedTrip(e.target.value)} className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]" required>
                            {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ministry Partner *</label>
                        <select value={selectedPartner} onChange={(e) => setSelectedPartner(e.target.value)} className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]" required>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                        <input type="number" className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary min-h-[44px]" placeholder="e.g. 50" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" max="10000" required />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={handleSave} className="btn btn-primary">
                        <Save className="h-4 w-4 mr-2" /> Save Entry
                    </button>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200 card-shadow">
                <div className="px-6 py-4 border-b border-gray-200 bg-[#FAFAFA] flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Mercy Bag Distribution Log</h3>
                    <span className="text-xs text-gray-500 flex items-center"><Lock className="h-3 w-3 mr-1" /> Entries are locked upon saving</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Date Saved</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Mission Trip</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Partner</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {mercyBagEntries.length === 0 ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500 italic">No distributions recorded yet.</td></tr>
                            ) : (
                                mercyBagEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{entry.savedAt}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{getTripName(entry.tripId)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{getPartnerName(entry.partnerId)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-primary">{entry.qty}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
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

export default MercyBagManager;
