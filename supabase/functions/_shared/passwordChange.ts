import {INITIAL_PASSWORD} from '../../../shared/accountCredentials.ts';
export class PasswordChangeError extends Error{constructor(public status:number,message:string){super(message);}}
/** Authenticated self changes are distinct from administrative resets. */
export async function changePassword(db:any,actor:any,body:Record<string,unknown>,principal:boolean,superAdmin:boolean,institution:string|null){
 const targetId=typeof body.user_id==='string'&&body.user_id?body.user_id:actor.id;
 const self=targetId===actor.id;
 if(!self&&!principal)throw new PasswordChangeError(403,'Vous pouvez modifier uniquement votre propre mot de passe.');
 const password=String(body.new_password||body.password||'');
 if(password.length<6||password.length>128)throw new PasswordChangeError(400,'Le mot de passe doit contenir entre 6 et 128 caractères.');
 if(self&&password===INITIAL_PASSWORD)throw new PasswordChangeError(400,'Choisissez un mot de passe personnel différent du mot de passe initial.');
 const target=await db.auth.admin.getUserById(targetId);
 if(target.error||!target.data.user)throw new PasswordChangeError(404,'Compte introuvable.');
 if(!self){
  const [profile,roles]=await Promise.all([db.from('profiles').select('institution_id').eq('user_id',targetId).single(),db.from('user_roles').select('role').eq('user_id',targetId)]);
  if(profile.error||roles.error||!superAdmin&&(profile.data?.institution_id!==institution||roles.data?.some((r:any)=>r.role==='super_admin')))throw new PasswordChangeError(403,'Compte non autorisé.');
 }
 const result=await db.auth.admin.updateUserById(targetId,{password,app_metadata:{...target.data.user.app_metadata,must_change_password:!self}});
 if(result.error)throw new PasswordChangeError(400,'Le nouveau mot de passe a été refusé par le service de connexion. Vérifiez les règles du projet.');
 return {success:true,must_change_password:!self};
}
