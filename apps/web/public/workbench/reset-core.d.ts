export interface ResetPost {
  id: string; url: string | null; publishedAt: string;
  stage: "announced" | "scheduled" | "propagating" | "completed" | "banked_credited" | "info";
  evidence: "official" | "archive" | "unverified";
  original: string; translation: string | null; explanation: string | null;
}
export interface ResetEvent {
  id: string; type: "global" | "banked" | "quota_correction" | "unknown"; title: string; demo?: boolean;
  posts: ResetPost[];
  deadline: null | { at: string; kind: "upper_bound" | "execution_time"; basis: string;
    sourcePostId: string; alternativeAt: string | null; note: string | null; };
}
export interface Catalog { schemaVersion: 1; events: ResetEvent[]; }
export const SCHEMA_VERSION: 1;
export const TYPES: string[];
export const STAGES: string[];
export const TYPE_LABELS: Record<string,string>;
export function validateCatalog(input: unknown): Catalog;
export function instant(value: unknown): number | null;
export function safePostUrl(value: unknown, id: string): boolean;
export function beijing(value: unknown, seconds?: boolean): string;
export function pacific(value: unknown): string;
export function pacificEod(value: string, wording?: string): {at:string;alternativeAt:string|null;kind:string;basis:string};
export function duration(ms: number): string;
export function eventState(e: ResetEvent, now?: number): {code:string;label:string;done:ResetPost|null};
export function defaultPostIndex(e: ResetEvent, now?: number): number;
export function metrics(e: ResetEvent, p: ResetPost, now?: number): {
  current:string;elapsed:string;deadlineLabel:string;deadlineValue:string;deadlineNote:string;
  state:ReturnType<typeof eventState>;
};
export function actionText(e: ResetEvent, now?: number): string;
export function copyDraft(e: ResetEvent, now?: number, marketing?: boolean): string;
export function demoCatalog(now?: number): Catalog;
