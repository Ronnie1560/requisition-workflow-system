import React, { useState } from 'react';
import { BarChart, Download, X, Info } from 'lucide-react';

const HistoricalReports = ({ historicalData }) => {
    const [selectedReport, setSelectedReport] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = () => { setIsExporting(true); setTimeout(() => setIsExporting(false), 2000); };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 card-shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center"><BarChart className="h-6 w-6 mr-2 text-secondary" /> Historical Financial Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {historicalData.map(report => (
                        <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-primary transition-colors cursor-pointer shadow-sm" onClick={() => setSelectedReport(report)}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-bold text-gray-800">{report.name}</div>
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Audited</span>
                            </div>
                            <div className="text-2xl font-bold text-primary mb-1">{report.total.toLocaleString()} {report.currency}</div>
                            <div className="text-xs text-gray-500">Click to view breakdown</div>
                        </div>
                    ))}
                </div>
            </div>
            {selectedReport && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-lg animate-fade-in card-shadow">
                    <div className="px-6 py-4 bg-[#FAFAFA] border-b border-gray-200 flex justify-between items-center">
                        <h4 className="font-bold text-gray-800">Report Details: {selectedReport.name}</h4>
                        <div className="flex space-x-2">
                            <button onClick={handleExport} className="btn btn-outline text-sm" disabled={isExporting}>{isExporting ? "Exporting..." : <><Download className="h-4 w-4 mr-2" /> Export Excel</>}</button>
                            <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="h-64 flex items-end justify-around space-x-2 border-b border-gray-200 pb-4 mb-4">
                            {Object.entries(selectedReport.breakdown).map(([cat, val], idx) => (
                                <div key={cat} className="flex flex-col items-center w-full group">
                                    <div className="w-full bg-teal-50 rounded-t-md relative group-hover:bg-teal-100 transition-colors" style={{ height: `${(val / selectedReport.total) * 100}%` }}>
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{val.toLocaleString()}</div>
                                    </div>
                                    <div className="mt-2 text-xs font-medium text-gray-600 text-center">{cat}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {Object.entries(selectedReport.breakdown).map(([cat, val]) => (
                                <div key={cat} className="flex justify-between border-b border-gray-100 py-2">
                                    <span className="text-gray-600">{cat}</span>
                                    <span className="font-bold text-gray-900">{val.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="flex justify-between border-t border-gray-300 py-2 mt-2 font-bold text-lg">
                                <span>Total</span>
                                <span className="text-primary">{selectedReport.total.toLocaleString()} {selectedReport.currency}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoricalReports;
