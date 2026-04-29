import { MessageCircle, Zap } from "lucide-react";
import { useGame } from "@/game/state";

import { useShallow } from "zustand/react/shallow";

export const AgentDock = () => {
  const { agents, selectedAgent, setSelectedAgent, setScreen  } = useGame(useShallow(s => ({ agents: s.agents, selectedAgent: s.selectedAgent, setSelectedAgent: s.setSelectedAgent, setScreen: s.setScreen })));
  const hasAgents = agents.length > 0;

  return (
    <div className="absolute right-4 top-[148px] bottom-[120px] z-30 flex flex-col gap-2 pointer-events-auto overflow-y-auto scrollbar-hide pr-1">
      <div className="hud-panel-dark px-3 py-1.5 text-center sticky top-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-70">Party</p>
      </div>
      {agents.map((a) => (
        <button
          key={a.id}
          onClick={() => { setSelectedAgent(a.id); setScreen("chat"); }}
          className={`hud-panel w-[200px] p-2 flex gap-2 items-center hover:translate-x-[-2px] transition cursor-pointer relative text-left ${
            selectedAgent === a.id ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : ""
          }`}
        >
          <div className="relative">
            <img src={a.img} alt={a.name} className="h-10 w-10 rounded-xl object-cover bg-muted border-2 border-card" />
            {a.mood > 80 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-honey-gradient flex items-center justify-center border border-white shadow-soft">
                <Zap className="h-2.5 w-2.5 text-white fill-white" strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-extrabold text-foreground leading-none flex items-center gap-1">
                {a.name}
                {a.isYou && <span className="text-[8px] bg-primary text-primary-foreground px-1 py-0.5 rounded font-black">YOU</span>}
              </p>
              <span className="text-[10px] font-black text-foreground">{a.mood}</span>
            </div>
            <div className="xp-bar mt-1 h-2">
              <div
                className="xp-bar-fill"
                style={{
                  width: `${a.mood}%`,
                  background: a.mood < 50 ? "linear-gradient(180deg,hsl(12 88% 78%),hsl(8 80% 60%))"
                            : a.mood < 70 ? "linear-gradient(180deg,hsl(45 95% 70%),hsl(35 90% 55%))"
                            : undefined,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 truncate font-semibold">"{a.line}"</p>
          </div>
        </button>
      ))}
      <button
        onClick={() => {
          if (!hasAgents) return;
          setSelectedAgent(agents[0].id);
          setScreen("chat");
        }}
        disabled={!hasAgents}
        className="btn-game text-xs flex items-center justify-center gap-1.5 mt-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.8} />
        {hasAgents ? "Chat with agent" : "No agents yet"}
      </button>
    </div>
  );
};
