import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const MessagePopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  // Periodic tooltip animation
  useEffect(() => {
    if (!isOpen) {
      // Show tooltip initially after 3 seconds
      const initialTimer = setTimeout(() => {
        setShowTooltip(true);
      }, 3000);

      // Then flash periodically every 15 seconds
      const periodicTimer = setInterval(() => {
        setShowTooltip(true);
        // Hide after 4 seconds
        setTimeout(() => setShowTooltip(false), 4000);
      }, 15000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(periodicTimer);
      };
    } else {
      setShowTooltip(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setSending(true);
    setError('');

    try {
      // Simulated API call - replace with your actual Appwrite implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSuccess(true);
      setMessage('');
      setName('');
      
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Tooltip */}
      {showTooltip && !isOpen && (
        <div className="absolute bottom-20 right-0 mb-2 animate-bounce">
          <div className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg whitespace-nowrap">
            💡 Can't find what you are looking for? Suggest new words here!
            <div className="absolute bottom-[-6px] right-6 w-3 h-3 bg-gray-900 transform rotate-45"></div>
          </div>
        </div>
      )}

      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-yellow-900 hover:bg-yellow-950 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 flex items-center gap-2"
          aria-label="Open message form"
        >
          <MessageCircle size={24} />
        </button>
      ) : (
        <div className="bg-white rounded-lg shadow-2xl w-80 sm:w-96 overflow-hidden">
          {/* Header */}
          <div className="bg-yellow-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={20} />
              <h3 className="font-semibold">Send us a message</h3>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setSuccess(false);
                setError('');
              }}
              className="hover:bg-yellow-950 rounded p-1 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {success ? (
              <div className="text-center py-8">
                <div className="text-green-600 text-5xl mb-3">✓</div>
                <p className="text-green-600 font-semibold">Message sent successfully!</p>
                <p className="text-gray-600 text-sm mt-2">Thank you for reaching out.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-900 focus:border-transparent"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Have a word suggestion? Send it here and we will add it. (Ctrl+Enter to send)"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-900 focus:border-transparent resize-none"
                    maxLength={3000}
                  />
                  <p className="text-xs text-gray-500 mt-1">{message.length}/3000</p>
                </div>

                {error && (
                  <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={sending || !message.trim()}
                  className="w-full bg-yellow-900 hover:bg-yellow-950 disabled:bg-stone-300 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagePopup;