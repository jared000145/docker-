import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BOOTSTRAP_EMAIL || !BOOTSTRAP_PASSWORD || BOOTSTRAP_PASSWORD.length < 12) {
  throw new Error('Définir SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_EMAIL et BOOTSTRAP_PASSWORD (12 caractères minimum), uniquement côté serveur.');
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const created = await db.auth.admin.createUser({ email: BOOTSTRAP_EMAIL, password: BOOTSTRAP_PASSWORD, email_confirm: true, user_metadata: { first_name: 'Admin', last_name: 'RectorPlus' } });
if (created.error) throw created.error;
const result = await db.rpc('provision_account', { _user_id: created.data.user.id, _institution_id: null, _role: 'super_admin', _profile: { first_name: 'Admin', last_name: 'RectorPlus' } });
if (result.error) { await db.auth.admin.deleteUser(created.data.user.id); throw result.error; }
console.log('Super administrateur créé. Connectez-vous avec votre email dans l’onglet Email.');
