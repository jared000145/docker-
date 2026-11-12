const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function onboardingMessage(kind:string,request:any){
 const reference=request.id;const school=request.institution_name;
 const subject=kind==='received'?'Dossier reçu — examen en cours':kind==='approved'?'Établissement validé — essai gratuit de 14 jours':'Décision concernant votre dossier';
 const message=kind==='received'?`Nous avons reçu votre dossier pour ${school}. Le précontrôle documentaire est terminé. Notre équipe va examiner les pièces ; cet accusé de réception ne vaut pas validation. Vous recevrez un second email avec la décision. Votre essai gratuit de 14 jours commencera après validation, sans prélèvement automatique.`:kind==='approved'?`Votre établissement ${school} a été validé. Votre essai gratuit de 14 jours commence à la validation, sans prélèvement automatique. Les instructions de définition du mot de passe sont envoyées séparément. À l’issue de l’essai, choisissez un abonnement pour poursuivre l’utilisation.`:`Après examen, votre dossier pour ${school} n’a pas été accepté. Motif : ${request.rejection_reason||'Veuillez contacter notre équipe.'}. Vous pouvez répondre à cet email pour demander des précisions.`;
 return {subject:`RectorPlus — ${subject} [${reference}]`,text:`${message}\n\nRéférence : ${reference}\nVous pouvez répondre à cet email pour joindre notre équipe.`,html:`<div style="font-family:Arial,sans-serif;max-width:620px;color:#18304d"><h1 style="font-size:24px;color:#238ed1">RectorPlus</h1><h2 style="font-size:19px">${escape(subject)}</h2><p style="line-height:1.7">${escape(message)}</p><p style="font-size:12px">Référence : ${escape(reference)}</p><p>Vous pouvez répondre à cet email pour joindre notre équipe.</p></div>`};
}
export async function sendOnboardingEmails(db:any,requestId:string){
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('MAIL_FROM'),reply=Deno.env.get('MAIL_REPLY_TO');
 if(!key||!from||!reply)return {status:'queued',reason:'email_not_configured'};
 const request=await db.from('institution_preregistrations').select('*').eq('id',requestId).single();
 if(request.error)return {status:'queued',reason:'request_unavailable'};
 const claimed=await db.rpc('claim_preregistration_emails',{_request_id:requestId});
 if(claimed.error)return {status:'queued',reason:'queue_unavailable'};
 let failed=false;
 for(const mail of claimed.data||[]){
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'rectorplus-'+mail.id},body:JSON.stringify({from,to:[request.data.official_email],reply_to:reply,...onboardingMessage(mail.kind,request.data)})});
   if(!response.ok)throw Error('provider_'+response.status);
   const body=await response.json();if(typeof body.id!=='string')throw Error('provider_response');
   const saved=await db.from('preregistration_emails').update({status:'sent',provider_id:body.id,sent_at:new Date().toISOString(),last_error:null}).eq('id',mail.id);
   if(saved.error)throw Error('queue_update');
  }catch(error){failed=true;await db.from('preregistration_emails').update({status:'failed',last_error:error instanceof Error?error.message:'delivery_failed'}).eq('id',mail.id);}
 }
 const remaining=await db.from('preregistration_emails').select('id').eq('request_id',requestId).neq('status','sent');
 return {status:failed?'failed':remaining.data?.length?'queued':'sent'};
}
