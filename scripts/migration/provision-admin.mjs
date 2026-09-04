import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

async function loadEnv(fileName) {
  const text = await readFile(resolve(fileName), 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

await loadEnv(process.env.MIGRATION_ENV_FILE || '.env.migration.local');

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const organizationSlug = process.env.MIGRATION_ORGANIZATION_SLUG || 'img-imoveis-mogi-guacu';
const login = (process.env.MIGRATION_ADMIN_LOGIN || 'admin').trim().toLowerCase();
const email = process.env.MIGRATION_ADMIN_EMAIL || `${login}@img-imoveis.local`;
const password = process.env.MIGRATION_ADMIN_PASSWORD || `${randomBytes(18).toString('base64url')}A!9`;

if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: organization, error: organizationError } = await client
  .from('organizations')
  .select('id,name')
  .eq('slug', organizationSlug)
  .single();
if (organizationError || !organization) throw organizationError || new Error('Organização não encontrada.');

let user;
let created = false;
for (let page = 1; page <= 20 && !user; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find(candidate => candidate.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 1000) break;
}

if (!user) {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Admin' },
    app_metadata: { application: 'img-imoveis-crm' },
  });
  if (error || !data.user) throw error || new Error('Falha ao criar usuário administrador.');
  user = data.user;
  created = true;
} else if (process.argv.includes('--reset-password')) {
  const { data, error } = await client.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error || !data.user) throw error || new Error('Falha ao atualizar a senha do administrador.');
  user = data.user;
}

const { error: profileError } = await client.from('profiles').upsert({
  user_id: user.id,
  organization_id: organization.id,
  full_name: 'Admin',
  interfaces: [99],
  active: true,
}, { onConflict: 'user_id' });
if (profileError) throw profileError;

const credentialsPath = resolve('scripts/migration/source/admin-credentials.txt');
await mkdir(dirname(credentialsPath), { recursive: true });
if (created || process.argv.includes('--reset-password')) {
  await writeFile(credentialsPath, `login=${login}\nemail=${email}\npassword=${password}\n`, { encoding: 'utf8', mode: 0o600 });
}

console.log(JSON.stringify({
  success: true,
  created,
  passwordReset: !created && process.argv.includes('--reset-password'),
  login,
  email,
  userId: user.id,
  organizationId: organization.id,
  credentialsFileWritten: created || process.argv.includes('--reset-password'),
}, null, 2));
