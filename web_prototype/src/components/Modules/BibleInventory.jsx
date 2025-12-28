import React, { useState } from 'react';
import { BookOpen, ChevronRight, AlertCircle } from 'lucide-react';

const BibleInventory = ({ bibleQty, setBibleQty }) => {
    const [dialect, setDialect] = useState('Acholi');

    return (
        <div className="bg-white border border-teal-100 rounded-lg p-6 space-y-4 shadow-sm card-shadow">
            <div className="flex items-center justify-between border-b border-teal-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <BookOpen className="h-5 w-5 mr-2 text-primary" /> Bible Inventory Tracker
                </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">Target Dialect</label>
                    <div className="relative">
                        <select value={dialect} onChange={(e) => setDialect(e.target.value)} className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md shadow-sm appearance-none bg-white">
                            <option value="Acholi">Acholi (Northern)</option>
                            <option value="Lusoga">Lusoga (Eastern)</option>
                            <option value="Luganda">Luganda (Central)</option>
                            <option value="English">English (General)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <ChevronRight className="h-4 w-4 transform rotate-90" />
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">Quantity to Allocate</label>
                    <input type="number" value={bibleQty} onChange={(e) => setBibleQty(Number(e.target.value))} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2" />
                </div>
            </div>
            <div className="text-xs text-teal-700 bg-teal-50 p-3 rounded border border-teal-100 flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span><span className="font-bold">Logic Check:</span> Validating distribution region matches dialect <strong>"{dialect}"</strong>.</span>
            </div>
        </div>
    );
}

export default BibleInventory;
