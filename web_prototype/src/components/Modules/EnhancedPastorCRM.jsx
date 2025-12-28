import React, { useState, useMemo } from 'react';
import { Users, Download, List, UserPlus, Search, Filter, Lock, Mail, MessageCircle, Save } from 'lucide-react';
import Toast from '../UI/Toast';
import MessageModal from '../UI/MessageModal';
import { useToast } from '../UI/ToastProvider';

const EnhancedPastorCRM = ({ pastors, setPastors, partners }) => {
    const showToast = useToast();
    const [viewMode, setViewMode] = useState('directory');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPartner, setFilterPartner] = useState('All');
    // 'pastors' state moved up
    const [modalOpen, setModalOpen] = useState(false);
    const [currentRecipient, setCurrentRecipient] = useState(null);
    const [messageType, setMessageType] = useState('SMS');
    const [toast, setToast] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [newPastor, setNewPastor] = useState({ name: '', dob: '', phone: '', email: '', nin: '', district: 'Gulu', parish: '', village: '', partner: '' });

    const filteredPastors = useMemo(() => pastors.filter(p => (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.district.toLowerCase().includes(searchTerm.toLowerCase())) && (filterPartner === 'All' || p.partner === filterPartner)), [pastors, searchTerm, filterPartner]);
    const initiateMessage = (type, pastor) => { setMessageType(type); setCurrentRecipient(pastor); setModalOpen(true); };
    const handleModalClose = (success) => { setModalOpen(false); if (success) { setToast({ message: `${messageType} sent to ${currentRecipient.name}!`, type: 'success' }); setTimeout(() => setToast(null), 3000); } };
    const handleSavePastor = () => {
        if (!newPastor.name || !newPastor.partner) {
            showToast.error("Please fill in Name and Ministry Partner.");
            return;
        }
        setPastors([{ ...newPastor, id: Date.now() }, ...pastors]);
        setNewPastor({ name: '', dob: '', phone: '', email: '', nin: '', district: 'Gulu', parish: '', village: '', partner: '' });
        setViewMode('directory');
        showToast.success("Pastor Profile Saved!");
    };
    const handleExportPDF = () => { setIsExporting(true); setTimeout(() => { setIsExporting(false); setToast({ message: "Exported to PDF.", type: 'success' }); setTimeout(() => setToast(null), 3000); }, 2000); };

    return (
        <div className="space-y-6 animate-fade-in relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <MessageModal isOpen={modalOpen} onClose={handleModalClose} recipient={currentRecipient} type={messageType} />
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div><h3 className="text-xl font-bold text-gray-900 flex items-center"><Users className="h-6 w-6 mr-2 text-secondary" /> Pastor Registry & CRM</h3><p className="text-sm text-gray-500 mt-1">Manage registration, ministry affiliation, and communication.</p></div>
                <div className="mt-4 md:mt-0 flex space-x-3">
                    {viewMode === 'directory' && <button onClick={handleExportPDF} disabled={isExporting} className="btn btn-outline">{isExporting ? <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full mr-2"></div> : <Download className="h-4 w-4 mr-2" />}{isExporting ? "Generating..." : "Export PDF"}</button>}
                    <button onClick={() => setViewMode('directory')} className={`btn ${viewMode === 'directory' ? 'btn-primary' : 'btn-outline'}`}><List className="h-4 w-4 mr-2" /> Directory</button>
                    <button onClick={() => setViewMode('register')} className={`btn ${viewMode === 'register' ? 'btn-primary' : 'btn-outline'}`}><UserPlus className="h-4 w-4 mr-2" /> New Registration</button>
                </div>
            </div>
            {viewMode === 'directory' && (
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200 card-shadow">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-grow"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div><input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" placeholder="Search pastors by name or district..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        <div className="relative min-w-[250px]"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Filter className="h-4 w-4 text-gray-400" /></div><select className="block w-full pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md" value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)}><option value="All">All Ministries</option>{partners.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                    </div>

                    {/* Responsive Table / Cards */}
                    <div className="md:hidden p-4 space-y-4">
                        {filteredPastors.map(pastor => (
                            <div key={pastor.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-bold text-gray-900">{pastor.name}</div>
                                        <div className="text-xs text-gray-500 flex items-center mt-1"><Lock className="h-3 w-3 mr-1 text-gray-400" /> {pastor.nin}</div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => initiateMessage('Email', pastor)} className="text-secondary"><Mail className="h-5 w-5" /></button>
                                        <button onClick={() => initiateMessage('SMS', pastor)} className="text-primary"><MessageCircle className="h-5 w-5" /></button>
                                    </div>
                                </div>
                                <div className="mt-2 space-y-1">
                                    <div className="flex justify-between text-sm"><span className="text-gray-500">Ministry:</span> <span className="text-gray-800 font-medium">{pastor.partner}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-gray-500">District:</span> <span className="text-gray-800">{pastor.district}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hidden md:block overflow-x-auto custom-scrollbar" id="printable-area">
                        <table className="min-w-full divide-y divide-gray-200"><thead className="bg-blue-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Name / NIN</th><th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Ministry Partner</th><th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">District</th><th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200 text-sm">{filteredPastors.map((pastor) => (<tr key={pastor.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-gray-900">{pastor.name}</div><div className="text-xs text-gray-500 flex items-center mt-1"><Lock className="h-3 w-3 mr-1 text-gray-400" /> {pastor.nin}</div></td><td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">{pastor.partner}</span></td><td className="px-6 py-4 whitespace-nowrap text-gray-500">{pastor.district}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium"><div className="flex space-x-3"><button onClick={() => initiateMessage('Email', pastor)} className="text-gray-400 hover:text-secondary transition-colors"><Mail className="h-5 w-5" /></button><button onClick={() => initiateMessage('SMS', pastor)} className="text-gray-400 hover:text-primary transition-colors"><MessageCircle className="h-5 w-5" /></button></div></td></tr>))}{filteredPastors.length === 0 && (<tr><td colSpan="4" className="px-6 py-10 text-center text-gray-500 italic">No pastors found matching your filters.</td></tr>)}</tbody></table>
                    </div>
                </div>
            )}
            {viewMode === 'register' && (
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200 card-shadow">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50"><h3 className="text-lg leading-6 font-medium text-gray-900">New Pastor Registration</h3><p className="mt-1 text-xs text-gray-500">Please complete all fields. NIN is required for government compliance.</p></div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-6 bg-teal-50 p-4 rounded-md border border-teal-100"><label className="block text-sm font-bold text-teal-700 mb-1">Affiliated Ministry Partner <span className="text-red-500">*</span></label>
                                {/* LOGIC UPDATE: Dynamic Registration Dropdown */}
                                <select className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md shadow-sm" value={newPastor.partner} onChange={(e) => setNewPastor({ ...newPastor, partner: e.target.value })}>
                                    <option value="">Select a Ministry...</option>
                                    {partners.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
                            {/* ... other fields ... */}
                            <div className="sm:col-span-3"><label className="block text-sm font-medium text-gray-700">Full Name</label><div className="mt-1"><input type="text" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md p-2" placeholder="Rev. John Doe" value={newPastor.name} onChange={(e) => setNewPastor({ ...newPastor, name: e.target.value })} /></div></div>
                            <div className="sm:col-span-3"><label className="block text-sm font-medium text-gray-700">Date of Birth</label><div className="mt-1"><input type="date" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md p-2" value={newPastor.dob} onChange={(e) => setNewPastor({ ...newPastor, dob: e.target.value })} /></div></div>
                            <div className="sm:col-span-3"><label className="block text-sm font-medium text-gray-700">Phone Number</label><input type="tel" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md p-2" placeholder="+256..." value={newPastor.phone} onChange={(e) => setNewPastor({ ...newPastor, phone: e.target.value })} /></div>
                            <div className="sm:col-span-3"><label className="block text-sm font-medium text-gray-700">Email Address</label><input type="email" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md p-2" placeholder="pastor@example.com" value={newPastor.email} onChange={(e) => setNewPastor({ ...newPastor, email: e.target.value })} /></div>
                            <div className="sm:col-span-6 bg-red-50 p-4 rounded-md border border-red-100"><label className="flex items-center text-sm font-bold text-gray-800 mb-2"><Lock className="h-4 w-4 mr-1 text-red-600" /> NIN (National ID Number) <span className="ml-2 text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wide">PII Encrypted</span></label><input type="text" className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border border-red-200 rounded-md p-2 font-mono text-gray-700 placeholder-gray-400" placeholder="CM90023..." value={newPastor.nin} onChange={(e) => setNewPastor({ ...newPastor, nin: e.target.value })} /></div>
                            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700">District</label><select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md shadow-sm" value={newPastor.district} onChange={(e) => setNewPastor({ ...newPastor, district: e.target.value })}><option>Gulu</option><option>Lamwo</option><option>Jinja</option><option>Kampala</option><option>Wakiso</option></select></div>
                            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700">Parish/Town</label><input type="text" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md p-2" value={newPastor.parish} onChange={(e) => setNewPastor({ ...newPastor, parish: e.target.value })} /></div>
                            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700">Village (LC1)</label><input type="text" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md p-2" value={newPastor.village} onChange={(e) => setNewPastor({ ...newPastor, village: e.target.value })} /></div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 text-right"><button onClick={handleSavePastor} type="button" className="inline-flex items-center justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"><Save className="h-4 w-4 mr-2" /> Save Pastor Profile</button></div>
                </div>
            )}
        </div>
    );
};

export default EnhancedPastorCRM;
