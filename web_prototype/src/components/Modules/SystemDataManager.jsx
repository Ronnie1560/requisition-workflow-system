import React, { useState } from 'react';
import CrudTable from '../UI/CrudTable';
import { useToast } from '../UI/ToastProvider';
import Drawer from '../UI/Drawer';

const SystemDataManager = ({ trips, setTrips, partners, setPartners, items, setItems, impactStats, setImpactStats }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('trips');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    const openModal = (item = null) => {
        setEditingItem(item);
        if (item && activeTab === 'partners') {
            setFormData({ ...item, programsInput: item.programs ? item.programs.join(', ') : '' });
        } else {
            setFormData(item || {});
        }
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditingItem(null); setFormData({}); };

    const handleSave = () => {
        const id = formData.id || Date.now().toString();
        let newItem = { ...formData, id };

        if (activeTab === 'trips') {
            if (!formData.name) {
                toast.error("Please enter a name");
                return;
            }
            setTrips(prev => editingItem ? prev.map(i => i.id === newItem.id ? newItem : i) : [...prev, newItem]);
            toast.success(editingItem ? "Trip updated successfully!" : "Trip added successfully!");
        } else if (activeTab === 'partners') {
            if (!formData.name) {
                toast.error("Please enter a name");
                return;
            }
            const programsArray = formData.programsInput ? formData.programsInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
            newItem = { ...newItem, programs: programsArray }; delete newItem.programsInput;
            setPartners(prev => editingItem ? prev.map(i => i.id === newItem.id ? newItem : i) : [...prev, newItem]);
            toast.success(editingItem ? "Partner updated successfully!" : "Partner added successfully!");
        } else if (activeTab === 'items') {
            if (!formData.name) {
                toast.error("Please enter a name");
                return;
            }
            setItems(prev => editingItem ? prev.map(i => i.id === newItem.id ? newItem : i) : [...prev, newItem]);
            toast.success(editingItem ? "Item updated successfully!" : "Item added successfully!");
        }
        closeModal();
    };

    const handleDelete = (id) => {
        if (!window.confirm("Are you sure?")) return;
        if (activeTab === 'trips') {
            setTrips(prev => prev.filter(i => i.id !== id));
            toast.success("Trip deleted successfully!");
        }
        if (activeTab === 'partners') {
            setPartners(prev => prev.filter(i => i.id !== id));
            toast.success("Partner deleted successfully!");
        }
        if (activeTab === 'items') {
            setItems(prev => prev.filter(i => i.id !== id));
            toast.success("Item deleted successfully!");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex space-x-2 border-b border-gray-200 pb-1 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('trips')} className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${activeTab === 'trips' ? 'bg-white border-x border-t border-gray-200 text-primary' : 'text-gray-500 hover:text-gray-700'}`}>1. Mission Trips</button>
                <button onClick={() => setActiveTab('partners')} className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${activeTab === 'partners' ? 'bg-white border-x border-t border-gray-200 text-primary' : 'text-gray-500 hover:text-gray-700'}`}>2. Ministry Partners</button>
                <button onClick={() => setActiveTab('items')} className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${activeTab === 'items' ? 'bg-white border-x border-t border-gray-200 text-primary' : 'text-gray-500 hover:text-gray-700'}`}>3. Item Catalog</button>
            </div>
            {activeTab === 'trips' && <CrudTable title="Manage Mission Trips" data={trips} columns={[{ key: 'name', label: 'Trip Name' }, { key: 'status', label: 'Status' }]} onAdd={() => openModal()} onEdit={openModal} onDelete={handleDelete} />}
            {activeTab === 'partners' && <CrudTable title="Manage Ministry Partners" data={partners} columns={[{ key: 'name', label: 'Organization Name' }, { key: 'type', label: 'Type' }]} onAdd={() => openModal()} onEdit={openModal} onDelete={handleDelete} />}
            {activeTab === 'items' && <CrudTable title="Item Catalog" data={items} columns={[{ key: 'name', label: 'Item Name' }, { key: 'unit', label: 'Default Unit' }, { key: 'defaultCost', label: 'Std. Cost', render: (i) => i.defaultCost.toLocaleString() }]} onAdd={() => openModal()} onEdit={openModal} onDelete={handleDelete} />}

            <Drawer
                isOpen={isModalOpen}
                onClose={closeModal}
                title={`${editingItem ? 'Edit' : 'Add New'} ${activeTab === 'trips' ? 'Trip' : activeTab === 'partners' ? 'Partner' : 'Item'}`}
                size="md"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Name / Description *</label>
                        <input
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    {activeTab === 'trips' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Status *</label>
                            <select
                                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                                value={formData.status || 'Planning'}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option>Planning</option>
                                <option>Active</option>
                                <option>Completed</option>
                            </select>
                        </div>
                    )}

                    {activeTab === 'partners' && (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
                                <select
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                                    value={formData.type || 'Local Ministry'}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option>Local Ministry</option>
                                    <option>Logistics</option>
                                    <option>Medical</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Programs Supported (Comma Separated)</label>
                                <input
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                                    placeholder="e.g. Feeding, Medical, Education"
                                    value={formData.programsInput || ''}
                                    onChange={e => setFormData({ ...formData, programsInput: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-2">These will appear on the Public Impact Dashboard.</p>
                            </div>
                        </>
                    )}

                    {activeTab === 'items' && (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Default Unit *</label>
                                <input
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                                    value={formData.unit || ''}
                                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Default Unit Cost *</label>
                                <input
                                    type="number"
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                                    value={formData.defaultCost || ''}
                                    onChange={e => setFormData({ ...formData, defaultCost: Number(e.target.value) })}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button onClick={closeModal} className="btn btn-outline">Cancel</button>
                        <button onClick={handleSave} className="btn btn-primary">Save</button>
                    </div>
                </div>
            </Drawer>
        </div>
    );
};

export default SystemDataManager;
