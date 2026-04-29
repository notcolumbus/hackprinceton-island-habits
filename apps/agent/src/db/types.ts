export type Island = {
  _id: string; code: string; name: string; status: string;
  islandLevel: number; xp: number; currency: number;
};
export type Goal = {
  _id: string; text: string; islandId: string; phoneNumber: string;
  status: string; createdAt: number;
};
export type Agent = {
  _id: string; phoneNumber: string; motivation: number; personalityProfile: string;
};

export type PhotoAnalysisResponse = {
  is_task_proof: boolean;
  matched_goal_index: number | null;
  confidence: number;
  reason: string;
};

export type PhotoAutoCheckInResult = {
  checkedIn: boolean;
  reply?: string;
  reason?: string;
};

export type GoalLookup =
  | { ok: true; island: Island; goal: Goal; goals: Goal[] }
  | { ok: false; reason: "no-island" | "no-goals" | "out-of-range"; count?: number };
