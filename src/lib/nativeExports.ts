import * as XLSX from 'xlsx';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {toast} from 'sonner';
const exportsBridge=registerPlugin<{saveFile(options:{name:string;mime:string;data:string}):Promise<{saved?:boolean;cancelled?:boolean}>}>('RectorUpdates');
export async function saveNativeBlob(blob:Blob,name:string,mime='application/pdf'){
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
 return exportsBridge.saveFile({name,mime,data});
}
export function saveWorkbook(book:XLSX.WorkBook,name:string,options?:XLSX.WritingOptions){
 if(!Capacitor.isNativePlatform()){XLSX.writeFile(book,name,options);return;}
 const csv=name.toLowerCase().endsWith('.csv');const data=XLSX.write(book,{...options,bookType:csv?'csv':'xlsx',type:'base64'}) as string;
 void exportsBridge.saveFile({name,mime:csv?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',data}).catch(()=>toast.error('Le fichier ne peut pas être enregistré.'));
}
