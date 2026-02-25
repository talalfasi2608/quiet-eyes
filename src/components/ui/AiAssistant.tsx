import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import { sendChatMessage, apiFetch } from '../../services/api';
import type { ChatMessage } from '../../services/api';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, History, Zap } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface PromptTemplate {
  id: number;
  name: string;
  template_text: string;
  category: string;
  icon: string | null;
}

export default function AiAssistant() {
  const { user } = useAuth();
  const { currentProfile } = useSimulation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load prompt templates once
  useEffect(() => {
    apiFetch('/prompt-templates')
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  // Load chat history when chat opens
  const loadHistory = useCallback(async () => {
    if (!user?.id || historyLoaded) return;
    try {
      const res = await apiFetch(`/chat/${user.id}/history?limit=20`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        const mapped: ChatMessage[] = data.messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        setMessages(mapped);
        setHistoryLoaded(true);
        return;
      }
    } catch {
      // History not available, continue with welcome message
    }
    // No history — show welcome message
    if (currentProfile) {
      setMessages([
        {
          role: 'assistant',
          content: `שלום! אני סמנכ"ל התפעול (COO) הווירטואלי של ${currentProfile.nameHebrew} ${currentProfile.emoji}.\n\nאני מכיר את העסק שלך והמתחרים שלך לעומק. איך אוכל לעזור לך היום?`
        }
      ]);
    }
    setHistoryLoaded(true);
  }, [user?.id, currentProfile, historyLoaded]);

  useEffect(() => {
    if (isOpen && !historyLoaded) {
      loadHistory();
    }
  }, [isOpen, historyLoaded, loadHistory]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, suggestedQuestions]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Listen for custom event to open chat with pre-filled message
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent<{ message: string }>) => {
      setIsOpen(true);
      const prefillMessage = event.detail?.message;
      if (prefillMessage) {
        setInput(prefillMessage);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 200);
      }
    };

    window.addEventListener('openAiChat', handleOpenChat as EventListener);
    return () => {
      window.removeEventListener('openAiChat', handleOpenChat as EventListener);
    };
  }, []);

  const handleSendMessage = async (templateId?: number) => {
    if (!input.trim() || isLoading || !user?.id) return;

    const userMessage = input.trim();
    setInput('');
    setSuggestedQuestions([]);

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(user.id, userMessage, templateId);
      setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
      if (response.suggested_questions?.length) {
        setSuggestedQuestions(response.suggested_questions);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'מצטער, יש בעיה בחיבור. נסה שוב מאוחר יותר.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateClick = (template: PromptTemplate) => {
    if (isLoading || !user?.id) return;

    // Set template text as message and auto-send with template ID
    const userMessage = template.template_text;
    setMessages(prev => [...prev, { role: 'user', content: `${template.icon || '⚡'} ${template.name}` }]);
    setSuggestedQuestions([]);
    setIsLoading(true);

    sendChatMessage(user.id, userMessage, template.id)
      .then(response => {
        setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
        if (response.suggested_questions?.length) {
          setSuggestedQuestions(response.suggested_questions);
        }
      })
      .catch(() => {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'מצטער, יש בעיה בחיבור. נסה שוב מאוחר יותר.' }
        ]);
      })
      .finally(() => setIsLoading(false));
  };

  const handleSuggestedClick = (question: string) => {
    if (isLoading) return;
    setInput(question);
    setSuggestedQuestions([]);
    // Auto-focus input so user can hit Enter or edit
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!currentProfile) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-4 md:right-6 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          isOpen
            ? 'bg-gray-700 hover:bg-gray-600 rotate-90'
            : 'bg-gradient-to-br from-[#0066cc] to-[#00d4ff] hover:from-[#0077dd] hover:to-[#00e0ff] glow-primary'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-24 inset-x-0 mx-2 md:mx-0 md:inset-x-auto md:right-6 z-50 w-auto md:w-96 h-[calc(100vh-6rem)] md:h-[540px] rounded-2xl overflow-hidden shadow-2xl border border-gray-700/50 flex flex-col bg-gray-900/95 backdrop-blur-xl fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0066cc] to-[#0088dd] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold">AI COO</h3>
              <p className="text-white/70 text-sm">{currentProfile.emoji} {currentProfile.nameHebrew}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Quick Action Templates */}
          {templates.length > 0 && !input.trim() && !isLoading && (
            <div className="px-3 py-2 border-b border-gray-700/50 bg-gray-800/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] text-gray-500">פעולות מהירות</span>
              </div>
              <div className="flex flex-wrap gap-1.5" dir="rtl">
                {templates.slice(0, 5).map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateClick(t)}
                    className="px-2.5 py-1 rounded-full bg-gray-700/60 text-gray-300 text-xs hover:bg-cyan-600/30 hover:text-cyan-300 border border-gray-600/40 hover:border-cyan-500/40 transition-all"
                  >
                    {t.icon || '⚡'} {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" dir="rtl">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-[#0066cc]'
                      : 'bg-gradient-to-br from-[#0066cc] to-[#00d4ff]'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-[#0066cc] text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-100 rounded-tl-sm border border-gray-700/50'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {/* Suggested Questions */}
            {suggestedQuestions.length > 0 && !isLoading && (
              <div className="pt-1 pb-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-gray-500">שאלות מוצעות</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestedClick(q)}
                      className="text-right px-3 py-1.5 rounded-lg bg-gray-800/60 text-gray-300 text-xs hover:bg-cyan-600/20 hover:text-cyan-300 border border-gray-700/40 hover:border-cyan-500/40 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066cc] to-[#00d4ff] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-gray-400 text-sm">COO חושב...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-700/50 bg-gray-800/50">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="שאל אותי משהו..."
                disabled={isLoading}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                dir="rtl"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066cc] to-[#00d4ff] flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-[#0077dd] hover:to-[#00e0ff] transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2 text-center">
              AI COO - סמנכ"ל תפעול וירטואלי
            </p>
          </div>
        </div>
      )}
    </>
  );
}
