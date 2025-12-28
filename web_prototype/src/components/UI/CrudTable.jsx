import React from 'react';
import { PlusCircle, X, Info, FileText } from 'lucide-react';

const CrudTable = ({ title, data, columns, onAdd, onEdit, onDelete }) => (
    <div className="bg-white rounded-lg card-shadow border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onAdd} className="btn btn-primary">
                <PlusCircle className="h-4 w-4 mr-2" /> Add New
            </button>
        </div>
        <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50">
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{col.label}</th>
                        ))}
                        <th className="px-6 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {data.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            {columns.map((col, idx) => (
                                <td key={idx} className="px-6 py-4 whitespace-nowrap text-gray-700">
                                    {col.render ? col.render(item) : item[col.key]}
                                </td>
                            ))}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => onEdit(item)} className="text-primary hover:text-teal-700 mr-3 transition-colors">Edit</button>
                                <button onClick={() => onDelete(item.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                    <X className="h-4 w-4 inline" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-500 italic">
                                <div className="flex flex-col items-center justify-center w-full">
                                    <Info className="h-8 w-8 mb-2 text-gray-300" />
                                    No records found.
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        <div className="md:hidden p-4 space-y-4">
            {data.length === 0 ? (
                <div className="text-center text-gray-500 italic p-4 flex flex-col items-center">
                    <Info className="h-8 w-8 mb-2 text-gray-300" />
                    No records found.
                </div>
            ) : (
                data.map(item => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-gray-900">{item[columns[0].key]}</div>
                            <div className="flex space-x-2">
                                <button onClick={() => onEdit(item)} className="text-primary">
                                    <FileText className="h-4 w-4" />
                                </button>
                                <button onClick={() => onDelete(item.id)} className="text-red-400">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            {columns.slice(1).map((col, idx) => (
                                <div key={idx} className="text-sm flex justify-between">
                                    <span className="text-gray-500">{col.label}:</span>
                                    <span className="font-medium text-gray-800">{col.render ? col.render(item) : item[col.key]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
);

export default CrudTable;
