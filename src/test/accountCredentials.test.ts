import {expect,it,vi} from 'vitest';
import {INITIAL_PASSWORD,institutionInitials,personInitials} from '../../shared/accountCredentials';
import {changePassword} from '../../supabase/functions/_shared/passwordChange';
it('uses the requested initial password and readable initials with accents and connecting words',()=>{
 expect(INITIAL_PASSWORD).toBe('123456');expect(institutionInitials('Université Omar Bongo')).toBe('UOB');expect(institutionInitials('UOB')).toBe('UOB');expect(personInitials('Jean-Pierre','Nguéma')).toBe('JPN');expect(institutionInitials('École de la Réussite')).toBe('ER');
});
function fixture(tenant='school',role='user'){
 const update=vi.fn(async(_id:string,_payload:any)=>({data:{},error:null}));
 const db:any={auth:{admin:{getUserById:async(id:string)=>({data:{user:{id,app_metadata:{existing_tag:'preserved',must_change_password:true}}},error:null}),updateUserById:update}},from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,single:async()=>({data:{institution_id:tenant},error:null}),then:(resolve:any)=>Promise.resolve({data:table==='user_roles'?[{role}]:null,error:null}).then(resolve)};return q;}};
 return{db,update};
}
it('lets a non-principal staff member change their own password without a target id',async()=>{
 const{db,update}=fixture();await changePassword(db,{id:'staff'},{new_password:'secret'},false,false,'school');expect(update).toHaveBeenCalledWith('staff',{password:'secret',app_metadata:{existing_tag:'preserved',must_change_password:false}});
});
it('refuses staff resets of another user and preserves all accounts on refusal',async()=>{
 const{db,update}=fixture();await expect(changePassword(db,{id:'staff'},{user_id:'someone',new_password:'secret'},false,false,'school')).rejects.toMatchObject({status:403});expect(update).not.toHaveBeenCalled();
});
it('keeps administrative resets inside the institution and protects super-admin accounts',async()=>{
 const foreign=fixture('other');await expect(changePassword(foreign.db,{id:'owner'},{user_id:'foreign',new_password:'secret'},true,false,'school')).rejects.toMatchObject({status:403});
 const superUser=fixture('school','super_admin');await expect(changePassword(superUser.db,{id:'owner'},{user_id:'super',new_password:'secret'},true,false,'school')).rejects.toMatchObject({status:403});
});
it('accepts the initial password for an authorized reset but requires its replacement for self changes',async()=>{
 const{db,update}=fixture();await changePassword(db,{id:'owner'},{user_id:'staff',new_password:INITIAL_PASSWORD},true,false,'school');expect(update.mock.calls[0][1].app_metadata.must_change_password).toBe(true);
 await expect(changePassword(db,{id:'staff'},{new_password:INITIAL_PASSWORD},false,false,'school')).rejects.toMatchObject({status:400});
 await expect(changePassword(db,{id:'staff'},{new_password:'short'},false,false,'school')).rejects.toMatchObject({status:400});
});
