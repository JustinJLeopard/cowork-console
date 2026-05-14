export type TeammateState =
  | "working"
  | "idle-available"
  | "asleep"
  | "blocked-on-human"
  | "blocked-on-agent"
  | "errored";

export type Teammate = {
  id: string;
  name: string;
  role: string;
  signature_color: string;
  state: TeammateState;
  last_activity_ts: number;
  current_action: string;
};
