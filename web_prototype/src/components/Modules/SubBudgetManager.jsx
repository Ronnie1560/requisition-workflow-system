import React, { useState, useEffect } from 'react';
import { AlertCircle, Briefcase, FileText, FileSpreadsheet, PlusCircle, X, Info, CheckCircle, Save } from 'lucide-react';
import { useToast } from '../UI/ToastProvider';

const SubBudgetManager = ({ budgets, setBudgets, trips, partners, itemCatalog, appSettings }) => {
    const toast = useToast();
    const [viewMode, setViewMode] = useState('list');
    const [activeBudget, setActiveBudget] = useState(null);

    // --- View Details State ---
    const [viewDetailsBudget, setViewDetailsBudget] = useState(null);

    // --- Editor State ---
    const [selectedTrip, setSelectedTrip] = useState(trips[0]?.id);
    const [selectedPartner, setSelectedPartner] = useState(partners[0]?.id);
    const [currency, setCurrency] = useState('UGX');
    const [showActuals, setShowActuals] = useState(false);
    const [items, setItems] = useState([]);
    const [editingLineId, setEditingLineId] = useState(null);
    const [tempEditItem, setTempEditItem] = useState({});

    const getPartnerName = (id) => { const p = partners.find(p => p.id === id); return p ? p.name : <span className="text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Deleted Partner</span>; };
    const getTripName = (id) => { const t = trips.find(t => t.id === id); return t ? t.name : "Unknown Trip"; };

    // --- LOGIC UPDATE: Added Generic Fallback for New Partners ---
    const getInitialItems = (partnerId) => {
        // Find the partner object to check its type (optional logic enhancement)
        const partnerType = partners.find(p => p.id === partnerId)?.type;

        if (partnerId === "american_team" || partnerType === "Logistics") {
            return [
                { id: 101, desc: "Hotel Accommodation (Entebbe)", unit: "Rooms/Night", qty: 10, unitCost: 350000, actualUnitCost: 0, comments: [] },
                { id: 102, desc: "Bus Rental (Coaster)", unit: "Days", qty: 10, unitCost: 450000, actualUnitCost: 0, comments: [] },
                { id: 103, desc: "Airport Transfers", unit: "Trips", qty: 2, unitCost: 200000, actualUnitCost: 0, comments: [] }
            ];
        }
        else if (partnerId === "new_life" || partnerId === "cross_healing") {
            return [
                { id: 201, desc: "Meat (1 Bull ~120kg)", unit: "Bull", qty: 1, unitCost: 1500000, actualUnitCost: 0, comments: [] },
                { id: 202, desc: "Posho (Maize Flour)", unit: "Sacks", qty: 5, unitCost: 120000, actualUnitCost: 0, comments: ["Buy from Jinja"] },
                { id: 203, desc: "Firewood", unit: "Truck", qty: 1, unitCost: 300000, actualUnitCost: 0, comments: [] }
            ];
        }
        else {
            // GENERIC TEMPLATE for any new partner added via System Data
            return [
                { id: 901, desc: "Venue Rental / Contribution", unit: "Lumpsum", qty: 1, unitCost: 200000, actualUnitCost: 0, comments: [] },
                { id: 902, desc: "Refreshments (Water/Soda)", unit: "Crates", qty: 5, unitCost: 25000, actualUnitCost: 0, comments: [] },
                { id: 903, desc: "Lunch for Attendees", unit: "Plates", qty: 100, unitCost: 5000, actualUnitCost: 0, comments: [] }
            ];
        }
    };

    useEffect(() => {
        if (viewMode === 'editor') {
            if (activeBudget) {
                const budgetToEdit = budgets.find(b => b.id === activeBudget);
                if (budgetToEdit && budgetToEdit.items) {
                    setItems(budgetToEdit.items);
                } else {
                    setItems(getInitialItems(selectedPartner));
                }
            } else if (items.length === 0) {
                setItems(getInitialItems(selectedPartner));
            }
        }
    }, [viewMode, activeBudget]);

    const handleCreateNew = () => { setActiveBudget(null); setSelectedTrip(trips[0]?.id); setSelectedPartner(partners[0]?.id); setItems(getInitialItems(partners[0]?.id)); setViewMode('editor'); setEditingLineId(null); };

    const handleEditBudget = (budget) => {
        setActiveBudget(budget.id);
        setSelectedTrip(budget.trip);
        setSelectedPartner(budget.partner);
        setViewMode('editor');
        setEditingLineId(null);
    };

    const handleViewDetails = (budget) => {
        const itemsToView = budget.items || getInitialItems(budget.partner);
        setViewDetailsBudget({ ...budget, items: itemsToView });
    };

    const handleSaveBudget = () => {
        if (items.length === 0) {
            toast.error("Please add at least one line item.");
            return;
        }
        const total = items.reduce((acc, curr) => acc + (curr.qty * curr.unitCost), 0);

        if (activeBudget) {
            setBudgets(budgets.map(b => b.id === activeBudget ? { ...b, trip: selectedTrip, partner: selectedPartner, total, items: items, lastUpdated: "Just now" } : b));
            toast.success("Budget updated successfully!");
        } else {
            const newBudget = { id: Date.now(), trip: selectedTrip, partner: selectedPartner, total, items: items, lastUpdated: "Just now" };
            setBudgets([newBudget, ...budgets]);
            toast.success("Budget created successfully!");
        }
        setViewMode('list'); setActiveBudget(null); setEditingLineId(null);
    };

    const handleAddItem = () => {
        const newItem = { id: Date.now(), desc: "New Item", unit: "Pcs", qty: 1, unitCost: 0, actualUnitCost: 0, comments: [] };
        setItems([...items, newItem]);
        setEditingLineId(newItem.id);
        setTempEditItem(newItem);
    };

    const handleEditLine = (item) => { setEditingLineId(item.id); setTempEditItem(item); };
    const handleSaveLine = () => { setItems(items.map(i => i.id === tempEditItem.id ? tempEditItem : i)); setEditingLineId(null); };
    const handleDeleteLine = (id) => { if (confirm("Remove this line item?")) setItems(items.filter(i => i.id !== id)); };

    return (
        <div className="space-y-6 animate-fade-in relative">
            {/* View Details Modal */}
            {viewDetailsBudget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200 bg-[#FAFAFA] flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Budget Details: {getPartnerName(viewDetailsBudget.partner)}</h3>
                            <button onClick={() => setViewDetailsBudget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                <div><span className="text-gray-500">Mission Trip:</span> <span className="font-medium block">{getTripName(viewDetailsBudget.trip)}</span></div>
                                <div><span className="text-gray-500">Total Budget:</span> <span className="font-medium block text-primary font-bold text-lg">{viewDetailsBudget.total.toLocaleString()} {currency}</span></div>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-blue-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-secondary uppercase">Description</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-secondary uppercase">Qty</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-secondary uppercase">Unit Cost</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-secondary uppercase">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {viewDetailsBudget.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2">{item.desc}</td>
                                            <td className="px-4 py-2 text-right">{item.qty} {item.unit}</td>
                                            <td className="px-4 py-2 text-right">{item.unitCost.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-medium">{(item.qty * item.unitCost).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                            <button onClick={() => setViewDetailsBudget(null)} className="btn btn-outline">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'list' && (
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200 card-shadow">
                    <div className="px-6 py-4 border-b border-gray-200 bg-[#FAFAFA] flex justify-between items-center">
                        <div><h3 className="text-lg font-bold text-gray-900">Partner Sub-Budgets</h3><p className="text-xs text-gray-500">Manage individual budgets for each ministry partner.</p></div>
                        <button onClick={handleCreateNew} className="btn btn-primary"><PlusCircle className="h-4 w-4 mr-2" /> Create New</button>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {budgets.length === 0 ? <li className="px-6 py-12 text-center text-gray-500 italic flex flex-col items-center"><Info className="h-8 w-8 mb-2 text-gray-300" />No budgets created yet. Click "Create New" to start.</li> :
                            budgets.map(budget => (
                                <li key={budget.id} className="px-6 py-4 hover:bg-[#F5F5F5] transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-teal-50 flex items-center justify-center"><Briefcase className="h-5 w-5 text-teal-700" /></div>
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-900">{getPartnerName(budget.partner)}</div>
                                                <div className="text-xs text-gray-500">{getTripName(budget.trip)} • Last updated: {budget.lastUpdated}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <div className="text-right hidden sm:block"><div className="text-sm font-bold text-gray-900">{budget.total.toLocaleString()} {currency}</div><div className="text-xs text-gray-500">Total Budget</div></div>
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleViewDetails(budget)} className="p-1 text-blue-400 hover:text-blue-600" title="View Details"><FileText className="h-5 w-5" /></button>
                                                <button onClick={() => handleEditBudget(budget)} className="p-1 text-primary hover:text-teal-700" title="Edit Budget"><FileSpreadsheet className="h-5 w-5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                    </ul>
                </div>
            )}

            {viewMode === 'editor' && (
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200 card-shadow">
                    <div className="px-6 py-4 border-b border-gray-200 bg-[#FAFAFA] flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900">{activeBudget ? 'Edit Budget' : 'New Budget Worksheet'}</h3>
                        <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border border-gray-200">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Mission Trip</label><select value={selectedTrip} onChange={(e) => setSelectedTrip(e.target.value)} className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary">{trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Ministry Partner</label><select value={selectedPartner} onChange={(e) => setSelectedPartner(e.target.value)} className="block w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary">{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-gray-800">Line Items</h4>
                            <div className="flex items-center space-x-3">
                                <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={showActuals} onChange={(e) => setShowActuals(e.target.checked)} className="rounded text-primary focus:ring-primary" /><span>Show Actuals</span></label>
                                <button onClick={handleAddItem} className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded hover:bg-blue-100 border border-blue-200"><PlusCircle className="h-4 w-4 mr-1.5" /> Add Item</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-blue-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase w-1/3">Description</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase w-24">Qty / Unit</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase w-32">Unit Cost</th>
                                        {showActuals && <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase w-32">Actual Cost</th>}
                                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase w-32">Total</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-secondary uppercase w-20">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                    {items.map(item => (
                                        <tr key={item.id} className={editingLineId === item.id ? "bg-blue-50" : "hover:bg-gray-50"}>
                                            {editingLineId === item.id ? (
                                                <>
                                                    <td className="px-4 py-2"><input className="w-full border p-1 rounded text-sm" value={tempEditItem.desc} onChange={e => setTempEditItem({ ...tempEditItem, desc: e.target.value })} /></td>
                                                    <td className="px-4 py-2 text-right"><div className="flex items-center justify-end space-x-1"><input type="number" className="w-16 border p-1 rounded text-sm text-right" value={tempEditItem.qty} onChange={e => setTempEditItem({ ...tempEditItem, qty: Number(e.target.value) })} /><input className="w-16 border p-1 rounded text-sm" value={tempEditItem.unit} onChange={e => setTempEditItem({ ...tempEditItem, unit: e.target.value })} /></div></td>
                                                    <td className="px-4 py-2 text-right"><input type="number" className="w-full border p-1 rounded text-sm text-right" value={tempEditItem.unitCost} onChange={e => setTempEditItem({ ...tempEditItem, unitCost: Number(e.target.value) })} /></td>
                                                    {showActuals && <td className="px-4 py-2 text-right"><input type="number" className="w-full border p-1 rounded text-sm text-right" value={tempEditItem.actualUnitCost} onChange={e => setTempEditItem({ ...tempEditItem, actualUnitCost: Number(e.target.value) })} /></td>}
                                                    <td className="px-4 py-2 text-right font-medium">{(tempEditItem.qty * tempEditItem.unitCost).toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-center"><button onClick={handleSaveLine} className="text-primary hover:text-teal-700 mr-2"><CheckCircle className="h-4 w-4" /></button><button onClick={() => setEditingLineId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button></td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 font-medium text-gray-900">{item.desc}</td>
                                                    <td className="px-4 py-3 text-right text-gray-500">{item.qty} {item.unit}</td>
                                                    <td className="px-4 py-3 text-right text-gray-500">{item.unitCost.toLocaleString()}</td>
                                                    {showActuals && <td className="px-4 py-3 text-right text-gray-500">{item.actualUnitCost.toLocaleString()}</td>}
                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">{(item.qty * item.unitCost).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-center"><button onClick={() => handleEditLine(item)} className="text-blue-400 hover:text-blue-600 mr-2"><FileText className="h-4 w-4" /></button><button onClick={() => handleDeleteLine(item.id)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button></td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold">
                                    <tr>
                                        <td colSpan={showActuals ? 4 : 3} className="px-4 py-3 text-right text-gray-900 uppercase">Total Budget</td>
                                        <td className="px-4 py-3 text-right text-primary text-lg">{items.reduce((acc, curr) => acc + (curr.qty * curr.unitCost), 0).toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="flex justify-end space-x-3 border-t border-gray-200 pt-4">
                            <button onClick={() => setViewMode('list')} className="btn btn-outline">Cancel</button>
                            <button onClick={handleSaveBudget} className="btn btn-primary"><Save className="h-4 w-4 mr-2" /> Save Budget</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubBudgetManager;
