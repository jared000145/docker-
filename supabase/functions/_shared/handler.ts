import {INITIAL_PASSWORD,institutionInitials,personInitials} from '../../../shared/accountCredentials.ts';
import {changePassword,PasswordChangeError} from './passwordChange.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { reviewDocuments, ReviewError } from './documentReview.ts';
import { sendOnboardingEmails } from './onboardingMail.ts';
import {importStudent,StudentImportError} from './studentImport.ts';

const backend = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const failure = (error: unknown) => error instanceof HttpError ? error : new HttpError(500, 'Le service ne peut pas traiter cette demande.');
const check = (error: { message: string } | null) => { if (error) { console.error(error.message); throw new HttpError(400, 'Données invalides ou opération refusée.'); } };
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
const registrationProfiles: Record<string, { institution_type: string; cycle: string; enabled_cycles: string[] }> = {
  univ_lmd: { institution_type: 'university', cycle: 'lmd', enabled_cycles: ['universite'] },
  univ_bts: { institution_type: 'university', cycle: 'bts', enabled_cycles: ['universite'] },
  lycee: { institution_type: 'highschool', cycle: 'lmd', enabled_cycles: ['lycee'] },
  college: { institution_type: 'highschool', cycle: 'lmd', enabled_cycles: ['college'] },
  coll_lycee: { institution_type: 'highschool', cycle: 'lmd', enabled_cycles: ['college', 'lycee'] },
};
export function validateRegistration(body: Record<string, unknown>) {
  const text = (name: string, min: number, max: number) => { const value = typeof body[name] === 'string' ? body[name].trim() : ''; if (value.length < min || value.length > max) throw new HttpError(400, `Champ invalide : ${name}.`); return value; };
  const official_email = text('official_email', 3, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(official_email)) throw new HttpError(400, 'Email invalide.');
  const desired_slug = text('desired_slug', 3, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(desired_slug) || ['www','app','admin','api','preview','login','super-admin'].includes(desired_slug)) throw new HttpError(400, 'Identifiant établissement invalide.');
  const profile = registrationProfiles[String(body.profile)];
  if (!profile) throw new HttpError(400, 'Type d’établissement invalide.');
  return { institution_name: text('institution_name', 2, 200), director_name: text('director_name', 2, 200), official_email, desired_slug, phone: text('phone',0,30), address: text('address',0,500), ...profile };
}

export function serve(operation: string) {
  Deno.serve(async request => {
    const origins = [...new Set([...(Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()),'https://rectorplus.vercel.app','https://localhost','http://localhost:4173','http://127.0.0.1:4173','http://localhost:8080'])];
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (origin && origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.includes(origin)) return respond({ error: 'Origine refusée.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: 'Méthode non autorisée.' }, 405);
    try {
      if (Number(request.headers.get('content-length')) > 65536) throw new HttpError(413, 'Demande trop volumineuse.');
      const raw = await request.text();
      if (raw.length > 65536) throw new HttpError(413, 'Demande trop volumineuse.');
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON invalide.'); }
      if (!body || Array.isArray(body) || typeof body !== 'object') throw new HttpError(400, 'Demande invalide.');
      const db = backend();
      if(operation==='onboarding-status')return respond({document_review:!!Deno.env.get('OPENAI_API_KEY')&&!!Deno.env.get('DOCUMENT_REVIEW_MODEL'),email:!!Deno.env.get('RESEND_API_KEY')&&!!Deno.env.get('MAIL_FROM')&&!!Deno.env.get('MAIL_REPLY_TO')});

      if (operation === 'begin-preregistration') {
        const payload = validateRegistration(body);
        if(body.document_processing_consent!==true)throw new HttpError(400,'Votre accord est requis pour l’analyse des documents par notre prestataire.');
        if(!Deno.env.get('OPENAI_API_KEY')||!Deno.env.get('DOCUMENT_REVIEW_MODEL'))throw new HttpError(503,'Le dépôt est temporairement indisponible : le contrôle documentaire doit être activé par RectorPlus. Aucun document ne sera déclaré vérifié sans analyse.');
        const descriptors = body.documents as Record<string, { type?: string; size?: number }> | undefined;
        const id = crypto.randomUUID(); const token = crypto.randomUUID()+crypto.randomUUID();
        const paths: Record<string, string> = {};
        const types: Record<string, string> = { 'application/pdf':'pdf', 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' };
        for (const field of ['director_id','rccm','nif','agrement','logo']) {
          const descriptor = descriptors?.[field];
          if (!descriptor?.type || !Object.hasOwn(types,descriptor.type) || !Number.isFinite(descriptor.size) || descriptor.size!<=0 || descriptor.size!>10485760 || (field==='logo' && descriptor.type==='application/pdf')) throw new HttpError(400, 'Documents invalides : PDF ou image, 10 Mo maximum.');
          paths[`${field}_url`] = `intake/${id}/${field}.${types[descriptor.type]}`;
        }
        const source = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const result = await db.rpc('begin_preregistration', { _id:id, _token_hash:await hash(token), _payload:{...payload,document_processing_consent:true,consent_recorded_at:new Date().toISOString(),consent_version:'2026-11-08'}, _paths:paths, _rate_key:await hash(`intake:${source}`) });
        check(result.error);
        const uploads: Record<string, { path: string; token: string }> = {};
        for (const [field,path] of Object.entries(paths)) {
          const signed = await db.storage.from('preregistrations').createSignedUploadUrl(path);
          check(signed.error);
          uploads[field.replace('_url','')] = { path, token: signed.data!.token };
        }
        return respond({ id, token, uploads });
      }
      if (operation === 'submit-preregistration') {
        if (typeof body.id!=='string' || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.token!=='string' || body.token.length!==72) throw new HttpError(400, 'Session de dépôt invalide.');
        const digest=await hash(body.token);
        const intake=await db.rpc('claim_intake_review',{_id:body.id,_token_hash:digest});check(intake.error);
        if(intake.data.submitted_id)return respond({id:intake.data.submitted_id,status:'pending',email:await sendOnboardingEmails(db,intake.data.submitted_id)});
        let review=intake.data.review;
        if(!review){
          try{review=await reviewDocuments(db,intake.data.paths,intake.data.payload);}
          catch(error){await db.rpc('finish_intake_review',{_id:body.id,_token_hash:digest,_review:null});if(error instanceof ReviewError)throw new HttpError(error.status,error.message);throw error;}
          const saved=await db.rpc('finish_intake_review',{_id:body.id,_token_hash:digest,_review:review});check(saved.error);
        }
        if(review.status!=='ready')return respond({error:'Certaines pièces ne correspondent pas aux documents demandés ou sont illisibles. Remplacez-les puis renvoyez votre dossier.',documents:review.documents},422);
        const result = await db.rpc('submit_preregistration', { _id:body.id, _token_hash:digest });
        check(result.error);
        return respond({ id:result.data, status:'pending',email:await sendOnboardingEmails(db,result.data) });
      }

      if (operation === 'request-password-reset') {
        const email = String(body.email || '').trim().toLowerCase();
        const matricule = String(body.matricule || '').trim();
        if (!email && matricule && !Deno.env.get('RESEND_API_KEY')) throw new HttpError(503, 'La récupération par matricule doit être configurée par votre établissement.');
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email || matricule.toLowerCase()));
        const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        const limit = await db.rpc('consume_reset_attempt', { _key: key });
        check(limit.error);
        if (!limit.data) return respond({ error: 'Veuillez patienter avant de réessayer.', retry_after: 60 }, 429);
        const site = new URL(Deno.env.get('PUBLIC_APP_URL') || 'http://localhost:8080');
        const redirectTo = new URL('/reset-password', site).href;
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          const reset = await db.auth.resetPasswordForEmail(email, { redirectTo });
          if (reset.error) throw new HttpError(503, 'Le service de récupération est indisponible.');
        } else if (matricule && Deno.env.get('RESEND_API_KEY')) {
          const result = await db.from('profiles').select('email,recovery_email,tuteur_email').eq('student_number', matricule).limit(2);
          const profile = result.data?.length === 1 ? result.data[0] : null;
          const destination = profile?.recovery_email || profile?.tuteur_email;
          if (profile?.email && destination) {
            const link = await db.auth.admin.generateLink({ type: 'recovery', email: profile.email, options: { redirectTo } });
            if (link.data?.properties?.action_link) {
              const url = link.data.properties.action_link.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
              const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('MAIL_FROM'), to: destination, subject: 'RectorPlus — Réinitialisation', html: `<p>Une réinitialisation du mot de passe a été demandée.</p><p><a href="${url}">Choisir un nouveau mot de passe</a></p>` }) });
              if (!sent.ok) console.error('Recovery email delivery failed', sent.status);
            }
          }
        }
        return respond({ success: true, retry_after: 60 });
      }

      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) throw new HttpError(401, 'Connexion requise.');
      const auth = await db.auth.getUser(token);
      if (auth.error || !auth.data.user) throw new HttpError(401, 'Session invalide.');
      const actor = auth.data.user;
      const [profileResult, rolesResult, teamResult] = await Promise.all([
        db.from('profiles').select('institution_id').eq('user_id', actor.id).single(),
        db.from('user_roles').select('role').eq('user_id', actor.id),
        db.from('team_members').select('is_principal').eq('user_id', actor.id).maybeSingle(),
      ]);
      check(profileResult.error); check(rolesResult.error); check(teamResult.error);
      const roles = rolesResult.data!.map(row => row.role);
      const superAdmin = roles.includes('super_admin');
      const principal = superAdmin || (roles.includes('admin') && (!teamResult.data || teamResult.data.is_principal));
      if(operation==='update-user-password'){
        try{return respond(await changePassword(db,actor,body,principal,superAdmin,profileResult.data?.institution_id||null));}
        catch(error){if(error instanceof PasswordChangeError)throw new HttpError(error.status,error.message);throw error;}
      }
      if(actor.app_metadata?.must_change_password===true)throw new HttpError(403,'Remplacez votre mot de passe initial avant cette opération.');
      if (!principal) throw new HttpError(403, 'Droits administrateur principal requis.');
      if(operation==='send-preregistration-email'){
        if(!superAdmin)throw new HttpError(403,'Droits super administrateur requis.');
        if(typeof body.request_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.request_id))throw new HttpError(400,'Dossier invalide.');
        return respond(await sendOnboardingEmails(db,body.request_id));
      }
      if(operation==='reject-preregistration'){
        if(!superAdmin)throw new HttpError(403,'Droits super administrateur requis.');
        if(typeof body.request_id!=='string'||typeof body.reason!=='string')throw new HttpError(400,'Dossier et motif requis.');
        // Call with the reviewer's JWT so SQL evaluates auth.uid() and RLS.
        const caller=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
        const rejected=await caller.rpc('reject_preregistration',{_request_id:body.request_id,_reason:body.reason});check(rejected.error);
        return respond({success:true,email:await sendOnboardingEmails(db,body.request_id)});
      }
      if (operation === 'approve-preregistration') {
        if (!superAdmin) throw new HttpError(403, 'Droits super administrateur requis.');
        if (typeof body.request_id!=='string' || !/^[0-9a-f-]{36}$/i.test(body.request_id)) throw new HttpError(400, 'Dossier invalide.');
        const pending = await db.from('institution_preregistrations').select('*').eq('id',body.request_id).single();
        check(pending.error);
        if (pending.data.status!=='pending') throw new HttpError(409, 'Ce dossier a déjà été traité.');
        if(pending.data.document_review?.status!=='ready')throw new HttpError(409,'Le précontrôle documentaire doit être terminé avant validation.');
        const created = await db.auth.admin.createUser({ email:pending.data.official_email, password:INITIAL_PASSWORD, email_confirm:true, app_metadata:{onboarding_request:body.request_id,must_change_password:true} });
        let userId=created.data.user?.id;
        if(created.error || !userId) {
          // Resume only an Auth account created by this exact server-owned request.
          const candidate=await db.from('profiles').select('user_id,institution_id').eq('email',pending.data.official_email).maybeSingle();
          if(candidate.error || !candidate.data || candidate.data.institution_id) throw new HttpError(409, 'Compte déjà existant ou création impossible. Le dossier reste en attente.');
          const existing=await db.auth.admin.getUserById(candidate.data.user_id);
          if(existing.error || existing.data.user?.app_metadata?.onboarding_request!==body.request_id) throw new HttpError(409, 'Cette adresse appartient à un autre compte.');
          userId=candidate.data.user_id;
        }
        const completed = await db.rpc('complete_preregistration', { _request_id:body.request_id, _admin_user_id:userId, _reviewer:actor.id });
        // A failed transaction leaves only a tagged, unassigned Auth account. A retry
        // resumes it; never delete a user that another reviewer may just have activated.
        check(completed.error);
        const assigned=await db.from('profiles').select('student_number').eq('user_id',userId).single();check(assigned.error);
        if(!assigned.data?.student_number){const code=await db.rpc('reserve_registration_number',{_institution:completed.data.institution_id,_prefix:institutionInitials(pending.data.institution_name),_initials:personInitials(pending.data.director_name,''),_key:'onboarding:'+body.request_id});check(code.error);const numbered=await db.from('profiles').update({student_number:code.data}).eq('user_id',userId);check(numbered.error);}

        const site = new URL(Deno.env.get('PUBLIC_APP_URL') || 'http://localhost:4173');
        const recovery = await db.auth.resetPasswordForEmail(pending.data.official_email, { redirectTo:new URL('/reset-password',site).href });
        return respond({ ...completed.data, invitationSent:!recovery.error,email:await sendOnboardingEmails(db,body.request_id), loginUrl:new URL(`/e/${completed.data.slug}`,site).href, customDomainUrl:null });
      }
      const institution = superAdmin ? String(body.institution_id || '') || null : profileResult.data!.institution_id;
      if (!superAdmin && body.institution_id && body.institution_id !== institution) throw new HttpError(403, 'Établissement non autorisé.');

      if (['create-student','import-student','create-professor','create-parent','create-team-member','create-admin','set-institution-admin'].includes(operation)) {
        if (['create-admin','set-institution-admin'].includes(operation) && !superAdmin) throw new HttpError(403, 'Droits super administrateur requis.');
        if (!institution) throw new HttpError(400, 'Établissement requis.');
        const inst = await db.from('institutions').select('id,is_active,name').eq('id', institution).single();
        check(inst.error);
        if (!inst.data?.is_active) throw new HttpError(400, 'Établissement inactif.');
        const access = await db.rpc('institution_accepts_users',{_institution_id:institution});
        check(access.error);
        if (!access.data) throw new HttpError(403, 'Abonnement inactif ou expiré.');
        if(operation==='import-student'){
          try{return respond(await importStudent(db,institution,body.row,body.import_key));}
          catch(error){if(error instanceof StudentImportError)throw new HttpError(error.status,error.message);throw error;}
        }
        if(operation==='set-institution-admin' && body.user_id) {
          const targetId=String(body.user_id);
          const [target,targetRoles,authTarget]=await Promise.all([
            db.from('profiles').select('institution_id').eq('user_id',targetId).single(),
            db.from('user_roles').select('role').eq('user_id',targetId),
            db.auth.admin.getUserById(targetId),
          ]);
          check(target.error);check(targetRoles.error);check(authTarget.error);
          if(target.data?.institution_id!==institution || !targetRoles.data?.some(row=>row.role==='admin') || targetRoles.data?.some(row=>row.role==='super_admin')) throw new HttpError(403,'Administrateur non autorisé pour cet établissement.');
          if(String(body.email || '').trim().toLowerCase()!==authTarget.data.user?.email?.toLowerCase()) throw new HttpError(400,'La modification de l’adresse email nécessite une procédure de vérification.');
          if(body.password) {
            const password=String(body.password);
            if(password.length<6 || password.length>128) throw new HttpError(400,'Le mot de passe doit contenir au moins 6 caractères.');
            const updated=await db.auth.admin.updateUserById(targetId,{password,app_metadata:{...authTarget.data.user?.app_metadata,must_change_password:true}});check(updated.error);
          }
          return respond({created:false,user_id:targetId});
        }
        const generatedPassword = !body.password;
        const password = String(body.password || INITIAL_PASSWORD);
        if (password.length < 6 || password.length > 128) throw new HttpError(400, 'Le mot de passe doit contenir au moins 6 caractères.');
        const first = String(body.first_name || body.full_name || '').trim();
        const last = String(body.last_name || '').trim();
        if (!first || (!last && operation !== 'create-parent')) throw new HttpError(400, 'Nom et prénom requis.');
        const student = operation === 'create-student';
        const professor = operation === 'create-professor';
        const reservation=await db.rpc('reserve_registration_number',{_institution:institution,_prefix:institutionInitials(inst.data.name),_initials:personInitials(first,last),_key:'manual:'+institution+':'+operation+':'+(typeof body.request_key==='string'&&/^[a-f0-9-]{36}$/i.test(body.request_key)?body.request_key:crypto.randomUUID())});check(reservation.error);
        const number=reservation.data as string;
        const normalized = number.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normalized) throw new HttpError(400, 'Matricule invalide.');
        const email = student ? `${normalized}@student.campusflow.com` : professor ? `${normalized}@prof.campusflow.com` : String(body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email invalide.');
        const role = student ? 'user' : professor ? 'professor' : operation === 'create-parent' ? 'parent' : 'admin';
        const created = await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata:{must_change_password:password===INITIAL_PASSWORD}, user_metadata: { first_name: first, last_name: last } });
        check(created.error);
        const userId = created.data.user!.id;
        const team = role === 'admin' ? { team_role: operation === 'create-team-member' ? body.team_role || 'role_personnalise' : 'admin_principal', is_principal: operation !== 'create-team-member', academic_scope: ['all','licence','master','college','lycee'].includes(String(body.academic_scope)) ? body.academic_scope : 'all', allowed_modules: Array.isArray(body.allowed_modules) ? body.allowed_modules : [] } : null;
        const provision = await db.rpc('provision_account', { _user_id: userId, _institution_id: institution, _role: role, _profile: { ...body, first_name: first, last_name: last, student_number: number }, _team: team, _children: Array.isArray(body.student_user_ids) ? body.student_user_ids : [] });
        if (provision.error) { await db.auth.admin.deleteUser(userId); check(provision.error); }
        return respond({ user_id: userId, matricule: number, created: true, ...(generatedPassword ? { generated_password: true, password } : {}) });
      }
      throw new HttpError(501, 'Cette fonction nécessite encore son implémentation métier.');
    } catch (error) {
      if (!(error instanceof HttpError)) console.error(error);
      const result = failure(error);
      return respond({ error: result.message }, result.status);
    }
  });
}
