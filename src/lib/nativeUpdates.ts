import {Capacitor,registerPlugin} from '@capacitor/core';
export interface NativeReleaseStatus{nativeVersion:string;nativeCode:number;webVersion:string;webBuild:number;pendingVersion:string;storeVersion:string;storeAvailable:boolean;notifications:boolean;rolledBack:boolean;channel:string;}
interface UpdateBridge{status():Promise<NativeReleaseStatus>;check(options:{userInitiated:boolean}):Promise<NativeReleaseStatus>;confirmReady(options:{build:number}):Promise<NativeReleaseStatus>;applyReady():Promise<void>;rollback():Promise<void>;openStore():Promise<void>;notifications(options:{enabled:boolean}):Promise<NativeReleaseStatus>;}
export const nativeUpdates=registerPlugin<UpdateBridge>('RectorUpdates');
export const isNativeApp=()=>Capacitor.isNativePlatform();
export async function recoverNativeRelease(){if(isNativeApp())await nativeUpdates.rollback();else window.location.reload();}
