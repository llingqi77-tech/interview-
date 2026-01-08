
import React, { useState, useEffect, useRef } from 'react';
import { Character, Message, SimulationState } from '../types';
import { CHARACTERS } from '../constants';
import { generateAIReply } from '../services/geminiService';
import CharacterCard from './CharacterCard';

interface DiscussionPanelProps {
  state: SimulationState;
  onFinish: (messages: Message[]) => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const DiscussionPanel: React.FC<DiscussionPanelProps> = ({ state, onFinish }) => {
  const [messages, setMessages] = useState<Message[]>(state.messages);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [round, setRound] = useState(0);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const firstTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimTranscriptRef = useRef("");

  const MAX_ROUNDS = 20;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }
        // Accumulate final results into the input value
        if (finalText) {
          setInputValue(prev => prev + finalText);
        }
        // Update interim display only
        interimTranscriptRef.current = interimText;
      };

      recognitionRef.current.onend = () => {
        // Recognition normally doesn't stop unless we call stop() or there's an error/silent period
        // if it stopped accidentally, we might want to restart if isListening is still true,
        // but for now, we follow user's "manual stop" rule.
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };
    }

    // 3s Initial Logic: If no user action, Aggressive starts
    firstTurnTimeoutRef.current = setTimeout(() => {
      if (messages.length === 0 && !isListening && inputValue.length === 0) {
        const aggressiveChar = CHARACTERS.find(c => c.role === 'AGGRESSIVE') || CHARACTERS[0];
        triggerAITurn(aggressiveChar);
      }
    }, 3000);

    return () => {
      if (firstTurnTimeoutRef.current) clearTimeout(firstTurnTimeoutRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (firstTurnTimeoutRef.current) clearTimeout(firstTurnTimeoutRef.current);
      // We don't clear inputValue here so user can append if they start/stop multiple times
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const addMessage = (senderId: string, senderName: string, content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId,
      senderName,
      content,
      timestamp: Date.now(),
      type: 'message'
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const triggerAITurn = async (char: Character) => {
    if (round >= MAX_ROUNDS) return;

    setRound(prev => prev + 1);
    setActiveCharId(char.id);
    setIsTyping(true);

    try {
      // Use current messages for context
      const currentHistory = [...messages]; 
      const text = await generateAIReply(char, state.topic, state.jobTitle, currentHistory);
      setIsTyping(false);
      addMessage(char.id, char.name, text);
      setActiveCharId(null);

      // Scheduler Logic: Randomly allow multiple AI speakers in a row (up to 3)
      // Check probability for next AI (40% to keep going)
      const shouldContinue = Math.random() < 0.45;
      if (shouldContinue && round < MAX_ROUNDS) {
        const delay = 1000 + Math.random() * 2000;
        setTimeout(() => {
          const others = CHARACTERS.filter(c => c.id !== char.id);
          const nextChar = others[Math.floor(Math.random() * others.length)];
          triggerAITurn(nextChar);
        }, delay);
      }
    } catch (e) {
      console.error(e);
      setIsTyping(false);
      setActiveCharId(null);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    if (firstTurnTimeoutRef.current) clearTimeout(firstTurnTimeoutRef.current);
    
    // Check if user is interrupting an AI typing
    if (isTyping || activeCharId) {
      setIsInterrupted(true);
      setTimeout(() => setIsInterrupted(false), 2000);
    }

    // Ensure listening is stopped when sending
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userText = inputValue;
    addMessage('user', '你', userText);
    setInputValue("");
    interimTranscriptRef.current = "";
    
    // AI responds after user finishes, more random delay
    setTimeout(() => {
      const nextChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      triggerAITurn(nextChar);
    }, 1000 + Math.random() * 1500);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="bg-white border-b p-4 shadow-sm z-10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">高压模拟讨论</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase">回合数: {round}</p>
          </div>
          <button onClick={() => onFinish(messages)} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all">结束并评估</button>
        </div>
        <div className="flex justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CHARACTERS.map(c => (
            <CharacterCard key={c.id} character={c} isActive={activeCharId === c.id} isTyping={activeCharId === c.id && isTyping} />
          ))}
          <div className="flex flex-col items-center p-3 rounded-xl bg-white shadow-sm border-2 border-slate-200 min-w-[80px]">
             <div className="w-12 h-12 rounded-full border-2 border-slate-300 flex items-center justify-center bg-slate-100 text-slate-500 font-bold text-xs">YOU</div>
             <span className="mt-2 text-[10px] font-bold text-slate-700">我</span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 shadow-sm leading-relaxed">
           <p className="font-black mb-1 flex items-center gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
             </svg>讨论主题：
           </p>
           {state.topic}
        </div>

        {messages.map((msg) => {
          const isUser = msg.senderId === 'user';
          const char = CHARACTERS.find(c => c.id === msg.senderId);
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                {!isUser && (
                  <div className="flex items-center mb-1 gap-2">
                    <span className="text-[10px] font-black text-indigo-500 uppercase">{char?.name.split(' (')[0]}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded text-white font-bold ${char?.color}`}>{char?.role === 'AGGRESSIVE' ? '抢位' : char?.role === 'STRUCTURED' ? '总结' : '细节'}</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {isInterrupted && (
          <div className="flex justify-center">
            <div className="bg-red-500 text-white text-[10px] py-1 px-4 rounded-full font-bold shadow-lg animate-bounce">
              检测到抢话！这会影响你的抗压评估分数。
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isListening ? "正在记录您的完整发言..." : "输入内容或点击语音开始..."}
              className={`w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl pl-4 pr-12 py-3 text-sm text-slate-900 resize-none h-24 transition-all outline-none ${isListening ? 'ring-4 ring-indigo-100' : ''}`}
            />
            <button 
              onClick={toggleListening}
              className={`absolute right-3 bottom-3 p-2.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              title={isListening ? "停止识别" : "开始语音识别"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                {isListening ? (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                )}
              </svg>
            </button>
          </div>
          <button onClick={handleSendMessage} disabled={!inputValue.trim()} className="bg-slate-900 text-white w-14 h-24 rounded-2xl flex items-center justify-center hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-md active:scale-95 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
        {isListening && (
          <div className="mt-2 text-[10px] text-indigo-600 font-bold flex items-center justify-center gap-1 animate-pulse">
            <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div> 
            实时录音中：直到您点击红色停止按钮前，我们将持续记录您的所有发言
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscussionPanel;
