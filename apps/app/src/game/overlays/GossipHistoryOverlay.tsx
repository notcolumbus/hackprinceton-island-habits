import { X, MessageCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useGame } from "../state";
import { useOverlayClose } from "@/hooks/useOverlayClose";

import { useShallow } from "zustand/react/shallow";

export const GossipHistoryOverlay = () => {
  const { screen, setScreen, agents, islandId  } = useGame(useShallow(s => ({ screen: s.screen, setScreen: s.setScreen, agents: s.agents, islandId: s.islandId })));
  const { closing, close } = useOverlayClose(() => setScreen(null));

  const conversations = useQuery(
    api.gossip.getGossipHistory,
    screen === "gossip" && islandId ? { islandId: islandId as Id<"islands"> } : "skip",
  );

  if (screen !== "gossip" && !closing) return null;

  const resolveName = (phone: string) =>
    agents.find((a) => a.id === phone)?.name ?? phone.slice(-4);

  return (
    <div
      className={`absolute inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-8 pointer-events-auto
        bg-black/50 backdrop-blur-sm
        ${closing ? "animate-out fade-out duration-150" : "animate-in fade-in duration-200"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={`hud-panel w-full max-w-md flex flex-col overflow-hidden max-h-[80vh]
        ${closing ? "animate-out slide-out-to-bottom duration-150" : "animate-in slide-in-from-bottom duration-300"}`}>

        <header className="flex items-center justify-between p-4 border-b border-foreground/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl btn-game flex items-center justify-center">
              <MessageCircle className="h-4 w-4" strokeWidth={2.8} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Island Logs</p>
              <p className="display-font text-base font-bold">Gossip History</p>
            </div>
          </div>
          <button onClick={close} className="h-9 w-9 rounded-xl bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {conversations === undefined && (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          )}
          {conversations?.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <p className="text-2xl">💬</p>
              <p className="text-sm font-bold text-muted-foreground">No conversations yet.</p>
              <p className="text-xs text-muted-foreground">Agents gossip when they bump into each other.</p>
            </div>
          )}
          {conversations?.map((conv) => {
            const nameA = resolveName(conv.agentAPhone);
            const nameB = resolveName(conv.agentBPhone);
            const date = new Date(conv.timestamp).toLocaleString(undefined, {
              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
            });
            return (
              <div key={conv._id} className="bg-card border border-border rounded-2xl p-3 space-y-2 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {nameA} &amp; {nameB}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{date}</p>
                </div>
                <div className="space-y-1.5">
                  {conv.lines.map((line, i) => {
                    const isA = line.speaker === "a";
                    const name = isA ? nameA : nameB;
                    return (
                      <div key={i} className={`flex gap-2 ${isA ? "" : "flex-row-reverse"}`}>
                        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] font-black text-primary">{name[0]}</span>
                        </div>
                        <div className={`max-w-[80%] rounded-xl px-2.5 py-1.5 text-xs leading-snug
                          ${isA ? "bg-secondary-soft text-foreground rounded-tl-sm" : "bg-primary-soft text-primary-foreground rounded-tr-sm"}`}>
                          <span className="font-bold mr-1">{name}:</span>{line.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
