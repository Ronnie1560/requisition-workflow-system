import React, { useState } from 'react';
import { Users, Building2, Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { useToast } from '../UI/ToastProvider';
import { EmptyPartners } from '../UI/EmptyState';
import Drawer from '../UI/Drawer';

const MinistryPartnersManager = ({ partners, setPartners }) => {
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState(null);
    const [formData, setFormData] = useState({});

    const openModal = (partner = null) => {
        setEditingPartner(partner);
        if (partner) {
            setFormData({
                ...partner,
                programsInput: partner.programs ? partner.programs.join(', ') : ''
            });
        } else {
            setFormData({ name: '', type: 'Local Ministry', programsInput: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPartner(null);
        setFormData({});
    };

    const handleSave = () => {
        // Validation
        if (!formData.name || formData.name.trim() === '') {
            toast.error("Please enter an organization name.");
            return;
        }
        if (!formData.type) {
            toast.error("Please select a partner type.");
            return;
        }

        const programsArray = formData.programsInput
            ? formData.programsInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
            : [];

        const newPartner = {
            id: formData.id || Date.now().toString(),
            name: formData.name.trim(),
            type: formData.type,
            programs: programsArray
        };

        setPartners(prev => editingPartner
            ? prev.map(p => p.id === newPartner.id ? newPartner : p)
            : [...prev, newPartner]
        );

        toast.success(editingPartner ? "Partner updated successfully!" : "Partner added successfully!");
        closeModal();
    };

    const handleDelete = (id) => {
        if (!window.confirm("Are you sure you want to delete this partner? This may affect associated data.")) return;
        setPartners(prev => prev.filter(p => p.id !== id));
        toast.success("Partner deleted successfully!");
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'Local Ministry': return 'bg-primary-50 text-primary-700 border-primary-200';
            case 'Medical': return 'bg-success-50 text-success-700 border-success-200';
            case 'Logistics': return 'bg-gray-50 text-gray-700 border-gray-200';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Building2 className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Ministry Partners</h2>
                            <p className="text-sm text-gray-600">Manage partner organizations and their programs</p>
                        </div>
                    </div>
                    <button onClick={() => openModal()} className="btn btn-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Partner
                    </button>
                </div>
            </div>

            {/* Partner Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {partners.map(partner => (
                    <div key={partner.id} className="bg-white rounded-xl shadow-card hover:shadow-card-hover p-6 border border-gray-100 transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{partner.name}</h3>
                                <span className={`badge ${getTypeColor(partner.type)}`}>
                                    {partner.type}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openModal(partner)}
                                    className="p-2 text-primary hover:bg-primary-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(partner.id)}
                                    className="p-2 text-error hover:bg-error-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {partner.programs && partner.programs.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                                    <Tag className="h-3 w-3 mr-1" />
                                    Programs Supported
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {partner.programs.map((prog, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-secondary-50 text-secondary-700 border border-secondary-200"
                                        >
                                            {prog}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {partners.length === 0 && (
                <div className="bg-white rounded-xl shadow-card border border-gray-100">
                    <EmptyPartners onAddPartner={() => openModal()} />
                </div>
            )}

            {/* Drawer */}
            <Drawer
                isOpen={isModalOpen}
                onClose={closeModal}
                title={`${editingPartner ? 'Edit' : 'Add New'} Partner`}
                size="md"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <Building2 className="h-4 w-4 inline mr-1" />
                            Organization Name *
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., New Life Ministries"
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Type *
                        </label>
                        <select
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            value={formData.type || 'Local Ministry'}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                            required
                        >
                            <option value="Local Ministry">Local Ministry</option>
                            <option value="Medical">Medical</option>
                            <option value="Logistics">Logistics</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <Tag className="h-4 w-4 inline mr-1" />
                            Programs Supported
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., Feeding, Medical, Education"
                            value={formData.programsInput || ''}
                            onChange={e => setFormData({ ...formData, programsInput: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Separate multiple programs with commas. These appear on the Public Dashboard.
                        </p>
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
                            {editingPartner ? 'Update' : 'Add'} Partner
                        </button>
                    </div>
                </div>
            </Drawer>
        </div>
    );
};

export default MinistryPartnersManager;
