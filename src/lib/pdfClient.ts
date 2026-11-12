import OriginalPDF from 'jspdf';
import {Capacitor} from '@capacitor/core';
import {saveNativeBlob} from './nativeExports';
import {toast} from 'sonner';
type jsPDF=OriginalPDF;
const jsPDF:typeof OriginalPDF=new Proxy(OriginalPDF,{construct(target,args){const doc=Reflect.construct(target,args) as OriginalPDF;if(Capacitor.isNativePlatform()){doc.save=((name='RectorPlus.pdf',options?:{returnPromise?:boolean})=>{const saving=saveNativeBlob(doc.output('blob'),name).then(()=>doc).catch(()=>{toast.error('Le PDF ne peut pas être enregistré.');return doc;});return options?.returnPromise?saving:doc;}) as OriginalPDF['save'];}return doc;}});
export default jsPDF;export {jsPDF};
