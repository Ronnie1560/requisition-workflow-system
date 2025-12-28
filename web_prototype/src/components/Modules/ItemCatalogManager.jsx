import React, { useState } from 'react';
import { Package, Plus, Edit2, Trash2, DollarSign } from 'lucide-react';
import { useToast } from '../UI/ToastProvider';
import Drawer from '../UI/Drawer';

const ItemCatalogManager = ({ items, setItems }) => {
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    const openModal = (item = null) => {
        setEditingItem(item);
        setFormData(item || { name: '', unit: '', defaultCost: '' });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleSave = () => {
        // Validation
        if (!formData.name || formData.name.trim() === '') {
            toast.error("Please enter an item name.");
            return;
        }
        if (!formData.unit || formData.unit.trim() === '') {
            toast.error("Please enter a unit of measurement.");
            return;
        }
        if (!formData.defaultCost || Number(formData.defaultCost) <= 0) {
            toast.error("Please enter a valid default cost (must be greater than 0).");
            return;
        }

        const newItem = {
            id: formData.id || Date.now(),
            name: formData.name.trim(),
            unit: formData.unit.trim(),
            defaultCost: Number(formData.defaultCost)
        };

        setItems(prev => editingItem
            ? prev.map(i => i.id === newItem.id ? newItem : i)
            : [...prev, newItem]
        );

        toast.success(editingItem ? "Item updated successfully!" : "Item added successfully!");
        closeModal();
    };

    const handleDelete = (id) => {
        if (!window.confirm("Are you sure you want to delete this item? This may affect budget calculations.")) return;
        setItems(prev => prev.filter(i => i.id !== id));
        toast.success("Item deleted successfully!");
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Package className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Item Catalog</h2>
                            <p className="text-sm text-gray-600">Manage items and default costs for budgeting</p>
                        </div>
                    </div>
                    <button onClick={() => openModal()} className="btn btn-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                    </button>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white shadow-card rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto table-container">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Item Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Unit</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Default Cost (UGX)</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500 italic">
                                        No items in catalog yet.
                                    </td>
                                </tr>
                            ) : (
                                items.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{item.unit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-primary">{item.defaultCost.toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => openModal(item)}
                                                    className="p-2 text-primary hover:bg-primary-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-error hover:bg-error-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drawer */}
            <Drawer
                isOpen={isModalOpen}
                onClose={closeModal}
                title={`${editingItem ? 'Edit' : 'Add New'} Item`}
                size="md"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <Package className="h-4 w-4 inline mr-1" />
                            Item Name *
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., Rice (Super)"
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Unit of Measurement *
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., Kg, Sacks, Days"
                            value={formData.unit || ''}
                            onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <DollarSign className="h-4 w-4 inline mr-1" />
                            Default Unit Cost (UGX) *
                        </label>
                        <input
                            type="number"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., 4500"
                            value={formData.defaultCost || ''}
                            onChange={e => setFormData({ ...formData, defaultCost: e.target.value })}
                            min="1"
                            required
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button
                            onClick={closeModal}
                            className="btn btn-outline"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn btn-primary"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {editingItem ? 'Update' : 'Add'} Item
                        </button>
                    </div>
                </div>
            </Drawer>
        </div>
    );
};

export default ItemCatalogManager;
