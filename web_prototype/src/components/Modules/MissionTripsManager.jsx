import React, { useState } from 'react';
import { MapPin, Calendar, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../UI/ToastProvider';
import { EmptyTrips } from '../UI/EmptyState';
import Drawer from '../UI/Drawer';

const MissionTripsManager = ({ trips, setTrips }) => {
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTrip, setEditingTrip] = useState(null);
    const [formData, setFormData] = useState({});

    const openModal = (trip = null) => {
        setEditingTrip(trip);
        setFormData(trip || { name: '', status: 'Planning' });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTrip(null);
        setFormData({});
    };

    const handleSave = () => {
        // Validation
        if (!formData.name || formData.name.trim() === '') {
            toast.error("Please enter a trip name.");
            return;
        }
        if (!formData.status) {
            toast.error("Please select a status.");
            return;
        }

        const newTrip = {
            ...formData,
            id: formData.id || Date.now().toString(),
            name: formData.name.trim()
        };

        setTrips(prev => editingTrip
            ? prev.map(t => t.id === newTrip.id ? newTrip : t)
            : [...prev, newTrip]
        );

        toast.success(editingTrip ? "Trip updated successfully!" : "Trip added successfully!");
        closeModal();
    };

    const handleDelete = (id) => {
        if (!window.confirm("Are you sure you want to delete this trip? This may affect associated data.")) return;
        setTrips(prev => prev.filter(t => t.id !== id));
        toast.success("Trip deleted successfully!");
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Planning': return 'bg-warning-50 text-warning-700 border-warning-200';
            case 'Active': return 'bg-success-50 text-success-700 border-success-200';
            case 'Completed': return 'bg-gray-50 text-gray-700 border-gray-200';
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
                            <MapPin className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Mission Trips</h2>
                            <p className="text-sm text-gray-600">Manage mission trip schedules and destinations</p>
                        </div>
                    </div>
                    <button onClick={() => openModal()} className="btn btn-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Trip
                    </button>
                </div>
            </div>

            {/* Trip Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map(trip => (
                    <div key={trip.id} className="bg-white rounded-xl shadow-card hover:shadow-card-hover p-6 border border-gray-100 transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{trip.name}</h3>
                                <span className={`badge ${getStatusColor(trip.status)}`}>
                                    {trip.status}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openModal(trip)}
                                    className="p-2 text-primary hover:bg-primary-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(trip.id)}
                                    className="p-2 text-error hover:bg-error-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>ID: {trip.id}</span>
                        </div>
                    </div>
                ))}
            </div>

            {trips.length === 0 && (
                <div className="bg-white rounded-xl shadow-card border border-gray-100">
                    <EmptyTrips onAddTrip={() => openModal()} />
                </div>
            )}

            {/* Drawer */}
            <Drawer
                isOpen={isModalOpen}
                onClose={closeModal}
                title={`${editingTrip ? 'Edit' : 'Add New'} Mission Trip`}
                size="md"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <MapPin className="h-4 w-4 inline mr-1" />
                            Trip Name / Location *
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            placeholder="e.g., June 2025 (Jinja/Kamuli)"
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Status *
                        </label>
                        <select
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
                            value={formData.status || 'Planning'}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            required
                        >
                            <option value="Planning">Planning</option>
                            <option value="Active">Active</option>
                            <option value="Completed">Completed</option>
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
                            <Plus className="h-4 w-4 mr-2" />
                            {editingTrip ? 'Update' : 'Add'} Trip
                        </button>
                    </div>
                </div>
            </Drawer>
        </div>
    );
};

export default MissionTripsManager;
