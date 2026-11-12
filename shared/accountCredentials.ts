export const INITIAL_PASSWORD='123456';
const ignored=new Set(['DE','DU','DES','LA','LE','LES','D','L','ET','THE','OF']);
const clean=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Œ/g,'OE').replace(/œ/g,'oe');
const words=(value:string)=>clean(value.replace(/([a-z])([A-Z])/g,'$1 $2')).toUpperCase().match(/[A-Z0-9]+/g)||[];
export function institutionInitials(name:string){
 const tokens=words(name).filter(word=>!ignored.has(word));
 if(tokens.length===1&&/^[A-Z0-9]{2,8}$/.test(name.trim()))return tokens[0];
 return tokens.map(word=>word[0]).join('').slice(0,12)||'ETAB';
}
export function personInitials(first:string,last:string){return words(first+' '+last).filter(word=>!ignored.has(word)).map(word=>word[0]).join('').slice(0,12)||'U';}
