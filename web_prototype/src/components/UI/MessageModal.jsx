import React, { useState } from 'react';
import { MessageCircle, Mail, X, Send } from 'lucide-react';

const MessageModal = ({ isOpen, onClose, recipient, type }) => {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    if (!isOpen) return null;

    const handleSend = () => {
        setSending(true);
        setTimeout(() => {
            setSending(false);
            setMessage('');
            onClose(true);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#FAFAFA]">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        {type === 'SMS' ? <MessageCircle className="h-5 w-5 mr-2 text-primary" /> : <Mail className="h-5 w-5 mr-2 text-secondary" />}
                        Send {type} to {recipient.name}
                    </h3>
                    <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="text-sm text-gray-500">To: <span className="font-medium text-gray-800">{type === 'SMS' ? recipient.phone : recipient.email}</span></div>
                    <textarea className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-primary focus:border-primary min-h-[120px]" placeholder={`Type your ${type} message here...`} value={message} onChange={(e) => setMessage(e.target.value)}></textarea>
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                    <button onClick={() => onClose(false)} className="btn btn-outline">Cancel</button>
                    <button onClick={handleSend} disabled={sending || !message} className={`btn ${sending || !message ? 'opacity-50 cursor-not-allowed' : 'btn-primary'}`}>
                        {sending ? 'Sending...' : <><Send className="h-4 w-4 mr-2" /> Send Message</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageModal;
