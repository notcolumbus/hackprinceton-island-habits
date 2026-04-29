import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { useGame } from "../state";
import { useOverlayClose } from "@/hooks/useOverlayClose";

import { useShallow } from "zustand/react/shallow";

export const ChatOverlay = () => {
  const { screen, setScreen, agents, selectedAgent, setSelectedAgent, chats, sendChat  } = useGame(useShallow(s => ({ screen: s.screen, setScreen: s.setScreen, agents: s.agents, selectedAgent: s.selectedAgent, setSelectedAgent: s.setSelectedAgent, chats: s.chats, sendChat: s.sendChat })));
  const { closing, close } = useOverlayClose(() => setScreen(null));
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const agent = agents.find((a) => a.id === selectedAgent) ?? agents[0];
  const messages = agent ? (chats[agent.id] ?? []) : [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, screen]);

  if (screen !== "chat" && !closing) return null;
  if (!agent) return null;

  const send = () => {
    if (!input.trim()) return;
    sendChat(agent.id, input.trim());
    setInput("");
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex items-stretch justify-end pointer-events-auto
        ${closing ? "animate-out fade-out duration-150" : "animate-in fade-in duration-200"}
        bg-black/40 backdrop-blur-sm`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={`hud-panel w-full max-w-md flex flex-col rounded-r-none
        ${closing ? "animate-out slide-out-to-right duration-150" : "animate-in slide-in-from-right duration-300"}`}>

        <header className="p-4 border-b border-foreground/10 flex items-center gap-3">
          <img src={agent.img} alt={agent.name} className="h-12 w-12 rounded-2xl object-cover border-2 border-card shadow-soft" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="display-font text-base font-bold">{agent.name}</p>
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="xp-bar h-1.5 w-24"><div className="xp-bar-fill" style={{ width: `${agent.mood}%` }} /></div>
              <span className="text-[10px] font-black text-foreground">{agent.mood}</span>
              <span className="text-[10px] text-muted-foreground font-semibold">· {agent.goal}</span>
            </div>
          </div>
          <button onClick={close} className="h-9 w-9 rounded-xl bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Agent switcher */}
        <div className="flex gap-1.5 p-3 border-b border-foreground/10 overflow-x-auto scrollbar-hide">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full transition ${
                a.id === selectedAgent ? "bg-progress-gradient text-white shadow-soft" : "bg-muted text-foreground"
              }`}
            >
              <img src={a.img} alt={a.name} className="h-6 w-6 rounded-full object-cover" />
              <span className="text-[11px] font-bold">{a.name}</span>
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-secondary-soft/30 to-card">
          <div className="flex justify-center">
            <div className="hud-panel-dark px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Conversation with {agent.name}
            </div>
          </div>
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.from === "you" ? "justify-end" : ""}`}>
              {m.from === "agent" && <img src={agent.img} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />}
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm font-semibold ${
                m.from === "you"
                  ? "bg-progress-gradient text-white rounded-br-sm"
                  : "bg-card border border-border rounded-bl-sm"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-foreground/10 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted border border-border text-sm font-semibold focus:outline-none focus:border-primary"
          />
          <button onClick={send} className="btn-game px-4 flex items-center gap-1.5">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
