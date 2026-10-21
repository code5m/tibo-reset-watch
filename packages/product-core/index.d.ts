export const PRODUCT_VERSION: number;
export interface Personal {
 schemaVersion: number;
 preferences: {theme:"system"|"light"|"dark";sources:string[];types:string[];windows:number[];enabled:boolean;quiet:{enabled:boolean;start:string;end:string}};
 tasks: {id:string;title:string;done:boolean;priority:"high"|"normal";createdAt:string;eventId:string|null}[];
 bookmarks:string[];
}
export const DEFAULT_PREFERENCES: Personal["preferences"];
export function emptyPersonal(): Personal;
export function validatePersonal(input: unknown): Personal;
export function inQuietHours(p: Personal["preferences"],now:number): boolean;
export function clockStatus(serverTime:unknown,requestStarted:number,receivedAt:number,lastSuccess:number|null,current?:number):{skew:number;calibrated:boolean;skewWarning:boolean;stale:boolean;age:number|null};
export function notificationCandidates(events:any[],preferences:Personal["preferences"],since:number,now?:number):{eventId:string;phase:string;sourcePostId:string;occurredAt:string;title:string;body:string}[];
export function deliveryLabel(item:any):string;
export function sourceLabel(event:any):string;
export function widgetSummary(event:any,updatedAt:string|null,now?:number):any;
