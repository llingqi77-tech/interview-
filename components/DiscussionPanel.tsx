
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
  const [showTopic, setShowTopic] = useState(true); // 默认显示题目
  
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
        if (finalText) {
          setInputValue(prev => prev + finalText);
        }
        interimTranscriptRef.current = interimText;
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };
    }

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
      const currentHistory = [...messages]; 
      const text = await generateAIReply(char, state.topic, state.jobTitle, currentHistory);
      setIsTyping(false);
      addMessage(char.id, char.name, text);
      setActiveCharId(null);

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
    
    if (isTyping || activeCharId) {
      setIsInterrupted(true);
      setTimeout(() => setIsInterrupted(false), 2000);
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    addMessage('user', '你', inputValue);
    setInputValue("");
    interimTranscriptRef.current = "";
    
    setTimeout(() => {
      const nextChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      triggerAITurn(nextChar);
    }, 1000 + Math.random() * 1500);
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative">
      {/* 主要聊天区域 */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ${showTopic ? 'mr-0 lg:mr-80' : 'mr-0'}`}>
        <div className="bg-white border-b p-4 shadow-sm z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowTopic(!showTopic)}
                className={`p-2 rounded-xl transition-all ${showTopic ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                title="查看/隐藏题目"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10.392A7.968 7.968 0 015.5 14c1.255 0 2.443.29 3.5.804V4.804zM11 4.804A7.968 7.968 0 0114.5 4c1.255 0 2.443.29 3.5.804v10.392a7.968 7.968 0 00-3.5-.804c-1.255 0-2.443.29-3.5.804V4.804z" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-800">高压模拟讨论</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">回合数: {round} / {MAX_ROUNDS}</p>
              </div>
            </div>
            <button onClick={() => onFinish(messages)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95">
              结束并评估
            </button>
          </div>
          <div className="flex justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CHARACTERS.map(c => (
              <CharacterCard key={c.id} character={c} isActive={activeCharId === c.id} isTyping={activeCharId === c.id && isTyping} />
            ))}
            <div className="flex flex-col items-center p-3 rounded-xl bg-white shadow-sm border-2 border-slate-100 min-w-[80px]">
               <div className="w-12 h-12 rounded-full border-2 border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 font-bold text-xs">YOU</div>
               <span className="mt-2 text-[10px] font-bold text-slate-600">我</span>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm font-medium">讨论即将开始，请准备发言...</p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.senderId === 'user';
            const char = CHARACTERS.find(c => c.id === msg.senderId);
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                  {!isUser && (
                    <div className="flex items-center mb-1 gap-2">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">{char?.name.split(' (')[0]}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded text-white font-bold ${char?.color}`}>{char?.role === 'AGGRESSIVE' ? '抢位' : char?.role === 'STRUCTURED' ? '总结' : '细节'}</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })}

          {isInterrupted && (
            <div className="flex justify-center sticky bottom-4">
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
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder={isListening ? "正在记录您的完整发言..." : "输入内容或按 Enter 发送..."}
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
              实时录音中：直到您点击停止前，我们将记录您的所有发言
            </div>
          )}
        </div>
      </div>

      {/* 侧边题目面板 */}
      <div className={`fixed lg:absolute top-0 right-0 h-full w-80 bg-white border-l shadow-2xl z-20 transition-transform duration-300 transform ${showTopic ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              讨论题目详情
            </h3>
            <button onClick={() => setShowTopic(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide text-sm text-slate-600 leading-relaxed whitespace-pre-wrap space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              {state.topic}
            </div>
            
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
               <h4 className="text-[10px] font-black text-indigo-600 uppercase mb-2 tracking-widest">面试提示</h4>
               <ul className="text-xs space-y-2 font-medium">
                 <li className="flex gap-2"><span className="text-indigo-600">•</span> 注意保持团队合作态度</li>
                 <li className="flex gap-2"><span className="text-indigo-600">•</span> 发言要逻辑清晰，简明扼要</li>
                 <li className="flex gap-2"><span className="text-indigo-600">•</span> 遇到分歧时尝试寻求共识</li>
               </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 遮罩层 (移动端展示题目时) */}
      {showTopic && (
        <div 
          onClick={() => setShowTopic(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] z-15 lg:hidden"
        />
      )}
    </div>
  );
};

export default DiscussionPanel;
