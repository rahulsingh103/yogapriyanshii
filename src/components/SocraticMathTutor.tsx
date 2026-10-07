import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { ChatMessage } from '../types';
import {
  Upload,
  Image as ImageIcon,
  Send,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Trash2,
  BrainCircuit,
  X,
  Compass,
  CheckCircle2,
} from 'lucide-react';

interface SocraticMathTutorProps {
  onBackToStudio: () => void;
}

export const SocraticMathTutor: React.FC<SocraticMathTutorProps> = ({ onBackToStudio }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I am your Socratic math tutor. Think of me as a patient teacher sitting right beside you at a quiet desk. Whether it's tricky calculus (integrals, related rates, optimization) or deep algebra, upload a photo of your problem or type it below. I won't just spoil the answer — we'll take it one gentle step at a time.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState<string>('gemini-3.1-pro-preview (Thinking: High)');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : inputPrompt;
    if (!text.trim() && !selectedImage) return;

    const currentImg = selectedImage;
    const currentMime = imageMime;

    // Append user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim() || 'Uploaded math problem for step-by-step guidance.',
      image: currentImg || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setSelectedImage(null);
    setLoading(true);

    try {
      // Map history
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.askMathTutor({
        messages: history,
        currentPrompt: userMsg.content,
        imageBase64: currentImg || undefined,
        mimeType: currentMime,
      });

      setModelUsed(res.modelUsed.includes('pro') ? 'gemini-3.1-pro-preview (Thinking: High)' : 'gemini-3.8-flash');

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          "I'm sorry, I hit a momentary snag processing that problem. Let's try again or simplify the query slightly.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const sampleProblems = [
    {
      label: 'Calculus: Related Rates',
      text: 'A 10-foot ladder rests against a vertical wall. If the bottom slides away at 1 ft/sec, how fast is the top sliding down when the bottom is 6 ft from the wall?',
    },
    {
      label: 'Calculus: Integration by Parts',
      text: 'Evaluate the indefinite integral: ∫ x² · e^(3x) dx',
    },
    {
      label: 'Algebra: Polynomial Roots',
      text: 'Find all real and complex roots of 2x³ - 3x² - 11x + 6 = 0 using rational root theorem.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#0f0e0b] flex flex-col justify-between">
      {/* Top Banner */}
      <div className="bg-[#0f0e0b] text-[#faf8f3] border-b border-[#faf8f3]/10 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#c4b48a]/20 text-[#c4b48a]">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl text-[#faf8f3]">
                Socratic AI Math Tutor
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-[#faf8f3]/60">
                <span className="text-[#c4b48a] font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {modelUsed}
                </span>
                <span>·</span>
                <span>Step-by-step Socratic Guidance</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToStudio}
            className="px-4 py-2 border border-[#faf8f3]/25 hover:border-[#faf8f3] text-xs font-semibold uppercase tracking-wider text-[#faf8f3] transition-colors"
          >
            ← Back to Yoga Studio
          </button>
        </div>
      </div>

      {/* Main Conversation Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* Sample Problem Quick Starters */}
        <div className="mb-4 bg-[#f2ede4] border border-[#0f0e0b]/10 p-3 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0f0e0b]/60 block mb-2">
            Try a sample problem or upload your own:
          </span>
          <div className="flex flex-wrap gap-2">
            {sampleProblems.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p.text)}
                className="text-xs px-3 py-1.5 bg-[#faf8f3] hover:bg-[#0f0e0b] hover:text-[#faf8f3] border border-[#0f0e0b]/15 transition-colors text-left"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Thread */}
        <div className="flex-1 bg-[#f2ede4]/60 border border-[#0f0e0b]/10 p-4 sm:p-6 overflow-y-auto max-h-[58vh] space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] text-[#0f0e0b]/50 mb-1 px-1">
                <span className="font-semibold uppercase tracking-wider">
                  {msg.role === 'user' ? 'You' : 'Socratic Tutor'}
                </span>
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-2xl p-4 sm:p-5 shadow-xs whitespace-pre-wrap leading-relaxed text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#0f0e0b] text-[#faf8f3]'
                    : 'bg-[#faf8f3] text-[#0f0e0b] border border-[#0f0e0b]/10'
                }`}
              >
                {msg.image && (
                  <div className="mb-3 max-w-xs border border-white/20 overflow-hidden bg-black/20">
                    <img
                      src={msg.image}
                      alt="Uploaded math problem"
                      className="w-full h-auto object-contain max-h-48"
                    />
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 text-[11px] text-[#0f0e0b]/50 mb-1 px-1">
                <span className="font-semibold uppercase tracking-wider">Socratic Tutor</span>
                <span>·</span>
                <span className="text-[#c4b48a] font-medium animate-pulse">Deep Thinking (High)...</span>
              </div>
              <div className="bg-[#faf8f3] border border-[#0f0e0b]/10 p-4 max-w-md text-xs text-[#0f0e0b]/70 flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-[#c4b48a] animate-spin" />
                <span>
                  Examining math problem structure and preparing Step 1 guiding question...
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Socratic Prompt Chips */}
        <div className="py-3 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-[#0f0e0b]/60 uppercase tracking-wider font-semibold">
            Socratic Prompts:
          </span>
          <button
            type="button"
            onClick={() => handleSendMessage('Why did we do that? Could you explain the intuition behind this step?')}
            className="text-xs px-3 py-1 bg-[#faf8f3] hover:bg-[#c4b48a] hover:text-[#0f0e0b] border border-[#0f0e0b]/15 transition-colors font-medium flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#c4b48a]" />
            &ldquo;Why did we do that?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("I'm not sure where to start. What is the very first step?")}
            className="text-xs px-3 py-1 bg-[#faf8f3] hover:bg-[#c4b48a] hover:text-[#0f0e0b] border border-[#0f0e0b]/15 transition-colors font-medium flex items-center gap-1"
          >
            <Lightbulb className="w-3.5 h-3.5 text-[#c4b48a]" />
            Walk me through Step 1
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("I think I understand that step. What should we do next?")}
            className="text-xs px-3 py-1 bg-[#faf8f3] hover:bg-[#c4b48a] hover:text-[#0f0e0b] border border-[#0f0e0b]/15 transition-colors font-medium"
          >
            What is the next step?
          </button>
        </div>

        {/* Input Bar & Image Upload Area */}
        <div className="bg-[#f2ede4] border border-[#0f0e0b]/15 p-4 shadow-xs">
          {selectedImage && (
            <div className="relative inline-block mb-3 border border-[#0f0e0b]/20 bg-white p-1">
              <img
                src={selectedImage}
                alt="Upload preview"
                className="h-20 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-[#0f0e0b] text-white p-1 rounded-full hover:bg-red-700"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-[#faf8f3] hover:bg-[#0f0e0b] hover:text-[#faf8f3] border border-[#0f0e0b]/15 text-[#0f0e0b] transition-colors flex items-center gap-1.5 shrink-0"
              title="Upload photo of calculus or algebra problem"
            >
              <Upload className="w-4 h-4 text-[#c4b48a]" />
              <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">
                Photo Problem
              </span>
            </button>

            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask a question or enter equation (e.g. ∫ x · sin(x) dx)..."
              className="flex-1 px-4 py-3 bg-[#faf8f3] border border-[#0f0e0b]/20 text-sm focus:outline-hidden focus:border-[#0f0e0b]"
            />

            <button
              type="button"
              disabled={loading || (!inputPrompt.trim() && !selectedImage)}
              onClick={() => handleSendMessage()}
              className="px-6 py-3 bg-[#0f0e0b] hover:bg-[#262420] text-[#faf8f3] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-[#0f0e0b]/50 mt-2">
            Tip: Upload a handwritten notebook snapshot, textbook page, or equation screenshot.
          </p>
        </div>
      </div>
    </div>
  );
};
