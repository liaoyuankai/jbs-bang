export type ActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
};

export const INITIAL_STATE: ActionState = {};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "出错了，请稍后再试";
}
