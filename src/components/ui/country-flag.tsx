import {useState} from 'react';
import {Globe2} from 'lucide-react';
export function CountryFlag({code,name,className=''}:{code:string;name:string;className?:string}){
 const[missing,setMissing]=useState(false);
 return missing?<Globe2 aria-label={name} className={`country-flag ${className}`}/>:<img src={`/flags/${code.toLowerCase()}.svg`} alt={`Drapeau : ${name}`} className={`country-flag ${className}`} loading="lazy" onError={()=>setMissing(true)}/>;
}
