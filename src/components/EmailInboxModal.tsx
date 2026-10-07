import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { EmailNotification } from '../types';
import { X, Mail, RefreshCw, Send, User, Calendar } from 'lucide-react';

interface EmailInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailInboxModal: React.FC<EmailInboxModalProps> = ({ isOpen, onClose }) => {
  const [emails, setEmails] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailNotification | null>(null);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const data = await api.getRecentEmails();
      setEmails(data);
      if (data.length > 0 && !selectedEmail) {
        setSelectedEmail(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEmails();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0f0e0b]/85 backdrop-blur-xs">
      <div className="bg-[#faf8f3] text-[#0f0e0b] border border-[#0f0e0b]/15 max-w-4xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#0f0e0b]/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0f0e0b] text-[#faf8f3]">
              <Mail className="w-4 h-4 text-[#c4b48a]" />
            </div>
            <div>
              <h3 className="font-serif text-xl sm:text-2xl text-[#0f0e0b]">
                Email Dispatch Monitor
              </h3>
              <p className="text-xs text-[#0f0e0b]/60">
                Live stream of confirmation emails sent to students and alerts sent to Priyanshi (<span className="text-[#c4b48a] font-medium">nbsingh2050@gmail.com</span>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadEmails}
              className="p-2 border border-[#0f0e0b]/15 text-[#0f0e0b]/70 hover:text-[#0f0e0b] rounded"
              title="Refresh inbox"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#0f0e0b]/50 hover:text-[#0f0e0b]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content: Master / Detail */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-[360px]">
          {/* Email List Column */}
          <div className="md:col-span-5 bg-[#f2ede4] border border-[#0f0e0b]/10 p-3 overflow-y-auto space-y-2">
            {loading && emails.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#0f0e0b]/50">
                Loading dispatched emails...
              </div>
            ) : emails.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#0f0e0b]/50">
                No emails dispatched yet. Book a free class to see both notifications appear here!
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                const isStudent = email.type === 'student_confirmation';

                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-3 border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#0f0e0b] text-[#faf8f3] border-[#0f0e0b]'
                        : 'bg-[#faf8f3] border-[#0f0e0b]/10 hover:border-[#c4b48a]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          isSelected
                            ? 'text-[#c4b48a]'
                            : isStudent
                            ? 'text-emerald-700'
                            : 'text-amber-800'
                        }`}
                      >
                        {isStudent ? 'Student Confirmation' : 'Studio Alert'}
                      </span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-[#faf8f3]/50' : 'text-[#0f0e0b]/40'}`}>
                        {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="font-semibold truncate mb-1">{email.subject}</p>
                    <p className={`text-[11px] truncate ${isSelected ? 'text-[#faf8f3]/70' : 'text-[#0f0e0b]/60'}`}>
                      To: {email.recipient}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Email Preview Column */}
          <div className="md:col-span-7 bg-[#faf8f3] border border-[#0f0e0b]/10 p-5 overflow-y-auto flex flex-col justify-between">
            {selectedEmail ? (
              <div>
                <div className="border-b border-[#0f0e0b]/10 pb-3 mb-4 space-y-1.5 text-xs text-[#0f0e0b]/80">
                  <div className="flex justify-between items-start">
                    <h4 className="font-serif text-base text-[#0f0e0b] font-semibold">
                      {selectedEmail.subject}
                    </h4>
                    <span className="text-[10px] font-mono text-[#0f0e0b]/50">
                      {new Date(selectedEmail.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <p><strong className="text-[#0f0e0b]">From:</strong> {selectedEmail.sender}</p>
                  <p><strong className="text-[#0f0e0b]">To:</strong> {selectedEmail.recipient}</p>
                </div>

                <div className="bg-[#f2ede4]/50 border border-[#0f0e0b]/8 p-4 text-xs font-sans leading-relaxed whitespace-pre-wrap text-[#0f0e0b]/90">
                  {selectedEmail.body}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-[#0f0e0b]/40">
                Select an email from the left to view its contents.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-[#0f0e0b]/10 flex items-center justify-between text-xs text-[#0f0e0b]/60">
          <span>Alerts are routed to <strong>nbsingh2050@gmail.com</strong> upon every booking.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#0f0e0b] text-[#faf8f3] text-xs font-semibold uppercase tracking-wider"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
