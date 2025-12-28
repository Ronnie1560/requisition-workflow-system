import React, { useState } from 'react';
import { Stethoscope, Calendar, MapPin, Users, PlusCircle, Info } from 'lucide-react';
import CrudTable from '../UI/CrudTable';
import { useToast } from '../UI/ToastProvider';
import Drawer from '../UI/Drawer';

const MedicalOutreachManager = ({ impactStats, setImpactStats, trips }) => {
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    const openModal = (item = null) => {
        setEditingItem(item);
        setFormData(item || {});
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleSave = () => {
        // Enhanced validation
        if (!formData.location || formData.location.trim() === '') {
            toast.error("Please enter a valid location.");
            return;
        }
        if (!formData.date) {
            toast.error("Please select a date.");
            return;
        }
        if (!formData.count || Number(formData.count) <= 0) {
            toast.error("Please enter a valid patient count (must be greater than 0).");
            return;
        }
        if (Number(formData.count) > 10000) {
            if (!window.confirm("You entered a very high patient count. Are you sure this is correct?")) {
                return;
            }
        }

        const newItem = {
            ...formData,
            id: formData.id || Date.now(),
            location: formData.location.trim(),
            count: Number(formData.count)
        };

        const updatedMedical = editingItem
            ? impactStats.medicalOutreach.map(m => m.id === newItem.id ? newItem : m)
            : [...impactStats.medicalOutreach, newItem];

        setImpactStats({ ...impactStats, medicalOutreach: updatedMedical });
        toast.success(editingItem ? "Medical outreach record updated successfully!" : "Medical outreach record added successfully!");
        closeModal();
    };

    const handleDelete = (id) => {
        if (!window.confirm("Are you sure you want to delete this outreach record?")) return;
        setImpactStats(prev => ({
            ...prev,
            medicalOutreach: prev.medicalOutreach.filter(m => m.id !== id)
        }));
        toast.success("Medical outreach record deleted successfully!");
    };

    const getTripName = (tripId) => {
        const trip = trips.find(t => t.id === tripId);
        return trip ? trip.name : 'N/A';
    };

    const totalPatients = impactStats.medicalOutreach.reduce((sum, record) => sum + Number(record.count), 0);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Stethoscope className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Medical & Malnutrition Outreach</h2>
                            <p className="text-sm text-gray-600">Track patient visits and outreach impact</p>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-white rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Patients</p>
                                <p className="text-3xl font-bold text-primary mt-1">{totalPatients.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-primary-50 rounded-lg">
                                <Users className="h-6 w-6 text-primary-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Locations Served</p>
                                <p className="text-3xl font-bold text-secondary mt-1">{impactStats.medicalOutreach.length}</p>
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
                                    {impactStats.medicalOutreach.length > 0
                                        ? Math.round(totalPatients / impactStats.medicalOutreach.length)
                                        : 0}
                                </p>
                            </div>
                            <div className="p-3 bg-teal-50 rounded-lg">
                                <Stethoscope className="h-6 w-6 text-teal-600" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-blue-900">About Medical & Malnutrition Outreach</h4>
                        <p className="text-xs text-blue-700 mt-1">
                            Record medical outreach events including patient counts, locations, and dates. These records contribute to the total "Lives Touched" metric on the public dashboard.
                        </p>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CrudTable
                title="Outreach Records"
                data={impactStats.medicalOutreach}
                columns={[
                    { key: 'location', label: 'Location' },
                    { key: 'date', label: 'Date' },
                    { key: 'count', label: 'Patients Served', render: (item) => item.count.toLocaleString() },
                    {
                        key: 'tripId',
                        label: 'Associated Trip',
                        render: (item) => (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {item.tripId ? getTripName(item.tripId) : 'Not Linked'}
                            </span>
                        )
                    }
                ]}
                onAdd={() => openModal()}
                onEdit={openModal}
                onDelete={handleDelete}
            />

            {/* Drawer */}
            <Drawer
                isOpen={isModalOpen}
                onClose={closeModal}
                title={`${editingItem ? 'Edit' : 'Add'} Outreach Record`}
                size="md"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <MapPin className="h-4 w-4 inline mr-1" />
                            Location *
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., Lamwo, Jinja, Village of Hope"
                            value={formData.location || ''}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <Calendar className="h-4 w-4 inline mr-1" />
                            Date *
                        </label>
                        <input
                            type="date"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            value={formData.date || ''}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <Users className="h-4 w-4 inline mr-1" />
                            Patients Served *
                        </label>
                        <input
                            type="number"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., 450"
                            value={formData.count || ''}
                            onChange={e => setFormData({ ...formData, count: e.target.value })}
                            min="1"
                            max="50000"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Associated Trip (Optional)
                        </label>
                        <select
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            value={formData.tripId || ''}
                            onChange={e => setFormData({ ...formData, tripId: e.target.value })}
                        >
                            <option value="">-- Not Linked --</option>
                            {trips.map(trip => (
                                <option key={trip.id} value={trip.id}>{trip.name}</option>
                            ))}
                        </select>
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
                            <PlusCircle className="h-4 w-4 mr-2" />
                            {editingItem ? 'Update' : 'Add'} Record
                        </button>
                    </div>
                </div>
            </Drawer>
        </div>
    );
};

export default MedicalOutreachManager;
