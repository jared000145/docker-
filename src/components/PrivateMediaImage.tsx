import {useEffect,useState,type ImgHTMLAttributes} from 'react';
import {resolvePrivateMedia} from '@/lib/privateMedia';
import {resolveSignatureUrl} from '@/lib/directorSignature';
export function PrivateMediaImage({src,signature=false,...props}:ImgHTMLAttributes<HTMLImageElement>&{signature?:boolean}){
 const [url,setUrl]=useState<string>();useEffect(()=>{let active=true;setUrl(undefined);if(src)(signature?resolveSignatureUrl(src):resolvePrivateMedia(src)).then(value=>{if(active)setUrl(value||undefined);}).catch(()=>{if(active)setUrl(undefined);});return()=>{active=false;};},[src,signature]);return url?<img {...props} src={url}/>:<span className={props.className} aria-label={props.alt||'Image indisponible'}/>;
}
