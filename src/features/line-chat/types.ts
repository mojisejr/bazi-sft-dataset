export type LineMessageRole = "user" | "model";

export interface LineMessageTurn {
  role: LineMessageRole;
  content: string;
}