import { useState } from "react";
import { X, Camera, Check, Sparkles } from "lucide-react";
import { useGame } from "../state";
import { useOverlayClose } from "@/hooks/useOverlayClose";

export const CheckInOverlay = () => {
  const { screen, setScreen, goals, completeGoal, pendingCheckIn, setPendingCheckIn } = useGame();
  const { closing, close } = useOverlayClose(() => {
    setScreen(null);
    setPendingCheckIn(null);
    setPhotoTaken(false);
  });
  const [photoTaken, setPhotoTaken] = useState(false);

  if (screen !== "checkin" && !closing) return null;

  const openGoals = goals.filter((g) => !g.done);

  const handleClose = () => {
    setPhotoTaken(false);
    close();
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-8 pointer-events-auto
        bg-black/50 backdrop-blur-sm
        ${closing ? "animate-out fade-out duration-150" : "animate-in fade-in duration-200"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className={`hud-panel w-full max-w-md flex flex-col overflow-hidden
        ${closing ? "animate-out slide-out-to-bottom duration-150" : "animate-in slide-in-from-bottom duration-300"}`}>

        <header className="flex items-center justify-between p-4 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl btn-game-coral flex items-center justify-center">
              <Camera className="h-4 w-4" strokeWidth={2.8} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Check-in</p>
              <p className="display-font text-base font-bold">{pendingCheckIn ? pendingCheckIn.text : "Mark a habit done"}</p>
            </div>
          </div>
          <button onClick={handleClose} className="h-9 w-9 rounded-xl bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition">
            <X className="h-4 w-4" />
          </button>
        </header>

        {!pendingCheckIn && (
          <div className="p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pick a habit</p>
            {openGoals.length === 0 && (
              <div className="bg-primary-soft rounded-xl p-4 text-center">
                <Sparkles className="h-6 w-6 text-primary mx-auto mb-1" />
                <p className="text-sm font-extrabold text-primary-foreground">All habits done today! 🎉</p>
              </div>
            )}
            {openGoals.map((g) => (
              <button
                key={g.id}
                onClick={() => setPendingCheckIn(g)}
                className="w-full text-left bg-card border-2 border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary hover:-translate-y-0.5 transition shadow-soft"
              >
                <div className="h-10 w-10 rounded-xl bg-secondary-soft flex items-center justify-center text-xl">{g.photo ? "📷" : "✓"}</div>
                <div className="flex-1">
                  <p className="text-sm font-extrabold">{g.text}</p>
                  <p className="text-[10px] font-bold text-honey-foreground flex items-center gap-1 mt-0.5">
                    🪵+1 🪨+1 XP{g.photo && " · photo proof"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {pendingCheckIn && (
          <div className="p-5 space-y-4">
            {pendingCheckIn.photo && (
              <div
                className={`aspect-video rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition ${
                  photoTaken ? "border-primary bg-primary-soft" : "border-border bg-muted hover:border-primary"
                }`}
                onClick={() => setPhotoTaken(true)}
              >
                {photoTaken ? (
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-progress-gradient flex items-center justify-center mx-auto mb-2">
                      <Check className="h-6 w-6 text-white" strokeWidth={3} />
                    </div>
                    <p className="text-sm font-bold text-primary-foreground">Photo captured!</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-bold text-muted-foreground">Tap to capture proof</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-honey-soft rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-honey-foreground">You'll earn</span>
              <span className="display-font text-lg font-black text-honey-foreground flex items-center gap-1">
                <Coins className="h-4 w-4" /> +{pendingCheckIn.reward}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setPendingCheckIn(null); setPhotoTaken(false); }}
                className="flex-1 py-3 rounded-xl bg-muted font-extrabold text-sm hover:bg-muted-foreground/20 transition"
              >
                Back
              </button>
              <button
                disabled={pendingCheckIn.photo && !photoTaken}
                onClick={() => {
                  completeGoal(pendingCheckIn.id);
                  setScreen(null);
                  setPhotoTaken(false);
                }}
                className="flex-1 btn-game disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
