# CRM IMG Imóveis

Aplicação interna para contratos, aniversários, checklists, cobranças, condomínios e campanhas manuais de WhatsApp. O frontend usa React/Vite e o backend oficial é PostgreSQL/Supabase com autenticação, RLS, controle de versão, auditoria e idempotência.

## Requisitos

- Node.js 22.22.2
- npm 11
- projeto Supabase com as migrações da pasta `supabase/migrations` aplicadas

## Desenvolvimento local

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Configure em `.env.local` somente a URL pública e a publishable key do Supabase. A service-role key nunca pode usar o prefixo `VITE_` nem ser incluída no frontend.

Antes de publicar:

```bash
npm run lint
npx vitest run src
npm run test:migration
npm run build
npm audit --omit=dev --audit-level=high
```

## Banco de dados e segurança

- A autenticação é feita pelo Supabase Auth.
- Cada usuário possui um perfil ligado a uma organização e uma lista de interfaces permitidas.
- Todas as tabelas de negócio usam RLS; chamadas anônimas são recusadas.
- As gravações compostas são funções PostgreSQL transacionais.
- UUIDs de operação impedem duplicação em timeouts e retentativas.
- Campos `version` aplicam concorrência otimista e retornam conflitos explícitos.
- `audit_log` registra alterações de negócio.

O arquivo `apps-script.js` é mantido apenas como histórico/contingência do sistema anterior. O frontend não chama mais o Google Apps Script.

## Migrações

As migrações devem ser aplicadas em ordem:

1. `202609030001_crm_core.sql`: modelo relacional, RLS, auditoria e funções base.
2. `202609030002_legacy_import.sql`: staging e importação idempotente do backup.
3. `202609040001_app_api.sql`: API transacional consumida pelo frontend.
4. `202609040002_cutover.sql`: ativa o Supabase como backend oficial.

O importador local exige `SUPABASE_SERVICE_ROLE_KEY` apenas em um arquivo ignorado pelo Git. Para validar a implantação real sem poluir a produção:

```bash
npm run migration:validate
npm run migration:import
npm run migration:provision-admin
npm run migration:smoke
```

O smoke test confirma acesso anônimo bloqueado, login/RLS, leituras de produção e todas as mutações em uma organização temporária removida no final.

## Campanhas e WhatsApp

- O envio continua humano: **Abrir WhatsApp** prepara a mensagem e **Confirmar envio** registra a confirmação.
- Destinatários são deduplicados por telefone normalizado dentro da campanha.
- **Desativar** pausa uma campanha sem apagar destinatários ou histórico; **Reativar** restaura a operação.
- A máquina de estados impede regressões depois de envio confirmado ou contato ignorado.

## Recuperação de falhas

- Em timeout, repita a mesma ação: a fila reaproveita o UUID e o banco devolve o resultado já confirmado.
- Em conflito de versão, recarregue os dados antes de decidir entre descartar ou sobrescrever.
- Filas críticas de checklist e campanhas permanecem no IndexedDB/localStorage durante falhas de rede.
- Ao sair da conta, as filas locais e a sessão são removidas.

## Segredos

- Nunca versione `.env.local`, `.env.migration.local`, credenciais, service-role keys ou backups com dados pessoais.
- A publishable key pode existir no bundle somente porque RLS e autenticação protegem cada operação.
- Revogue imediatamente qualquer chave secreta que seja exposta fora do ambiente administrativo.
