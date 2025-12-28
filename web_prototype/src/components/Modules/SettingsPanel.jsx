import React from 'react';
import { Lock, AlertCircle } from 'lucide-react';

const SettingsPanel = ({ settings, setSettings }) => {
    const handleChange = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));
    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 card-shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-4"><Lock className="h-6 w-6 mr-2 text-gray-400" /> System Configuration</h3>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div><h4 className="font-medium text-gray-900">Lock Budget Edits</h4><p className="text-sm text-gray-500">Prevent changes to approved budgets.</p></div>
                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={settings.lockBudgets} onChange={e => handleChange('lockBudgets', e.target.checked)} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div></label>
                    </div>
                    <div className="flex items-center justify-between">
                        <div><h4 className="font-medium text-gray-900">Enable Offline Mode Simulation</h4><p className="text-sm text-gray-500">Test app behavior without network.</p></div>
                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={settings.offlineMode} onChange={e => handleChange('offlineMode', e.target.checked)} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div></label>
                    </div>
                    <div className="flex items-center justify-between">
                        <div><h4 className="font-medium text-gray-900">Default Currency</h4><p className="text-sm text-gray-500">Set the base currency for reports.</p></div>
                        <select value={settings.defaultCurrency} onChange={(e) => handleChange('defaultCurrency', e.target.value)} className="border border-gray-300 rounded-md text-sm p-2 focus:ring-primary focus:border-primary"><option>UGX</option><option>USD</option></select>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                        <button className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 rounded-lg flex items-center transition-colors"><AlertCircle className="h-4 w-4 mr-2" /> Reset System Data</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
