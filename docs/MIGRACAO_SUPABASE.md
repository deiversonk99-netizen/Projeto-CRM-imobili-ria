# Migração do CRM para Supabase

## Situação atual

A migração foi iniciada sem alterar o funcionamento da aplicação em produção. O frontend continua usando o Google Apps Script porque `VITE_DATA_BACKEND` permanece com o valor `gas`. A troca só deve ocorrer depois da carga, reconciliação e homologação.

Já estão versionados neste repositório:

- esquema SQL relacional para cadastros, imóveis, contratos, pessoas, checklists, documentos, tarefas, cobranças, campanhas e destinatários;
- isolamento por organização e Row Level Security (RLS);
- auditoria das alterações e tabela de idempotência;
- staging que guarda cada linha original da planilha em JSON, com número da linha e checksum;
- mapa entre IDs legados e os novos UUIDs;
- importador reexecutável e relatório de reconciliação;
- validador local que não imprime dados pessoais;
- testes do contrato de migração e testes pgTAP do banco.

## Inventário confirmado do backup

Fonte: planilha `1fMcV6e2aUQ4y1zarOGZk0lbiNFTbkVTG`.

| Origem | Linhas observadas | Tratamento |
|---|---:|---|
| Cadastros | 26 | 25 contratos operacionais; o grupo duplicado fica integral no staging e ambos os IDs são mapeados |
| Checklists | 26 | vinculados ao contrato; JSON de documentos vira linhas relacionais |
| Tarefas | 40 | preservadas com referência e usuário legado |
| Condomínios | 5 | normalizados sem perder o nome original |
| Cobranças | 47 | unicidade por contrato + competência |
| Campanhas | 1 | status, filtros, mensagem e atividade preservados |
| Destinatários de campanhas | 53 | unicidade por campanha + contato; campanhas ausentes viram placeholders arquivados |
| Operações de campanha | 11 | histórico de idempotência |
| Operações de checklist | 4.458 | importadas sem depender da memória do navegador |

Esses números são uma fotografia preliminar. O relatório gerado na carga é a fonte final para autorizar o corte.

## Modelo e regras de preservação

1. `migration_source_rows` mantém todas as linhas originais, inclusive duplicidades, sem edição.
2. `legacy_identity_map` registra cada ID antigo e seu novo UUID.
3. `contracts` consolida a duplicidade por número normalizado de contrato.
4. Proprietário e inquilino são pessoas e vínculos separados. Um telefone compartilhado não funde nomes diferentes.
5. `charges` impede duas cobranças do mesmo contrato na mesma competência.
6. Checklists têm versionamento; documentos adicionais deixam de depender de um único JSON mutável.
7. Campanhas mantêm o fluxo manual `wa.me` e a confirmação humana. O banco registra abertura, confirmação, ignorado e erro.
8. Toda carga usa UUID determinístico e `ON CONFLICT`, portanto pode ser repetida após timeout sem criar cópias.

## Credenciais

A publishable/anon key pode ser usada no navegador somente depois que RLS e autenticação estiverem homologadas. Ela **não** autoriza criar tabelas nem importar dados.

Para aplicar o esquema são necessários um login do Supabase CLI e a senha do banco, uma `SUPABASE_DB_URL` completa, ou acesso ao SQL Editor. Para importar é necessária uma Secret/service-role key mantida apenas no ambiente local. Nunca use prefixo `VITE_` nessa chave e nunca faça commit dela.

Copie `.env.migration.example` para `.env.migration.local` e preencha o arquivo local, que está ignorado pelo Git:

```powershell
Copy-Item .env.migration.example .env.migration.local
```

## Execução segura

### 1. Exportar a planilha autenticada

No Google Sheets, abra o backup e escolha **Arquivo > Fazer download > Microsoft Excel (.xlsx)**. Salve como `scripts/migration/source/backup.xlsx`. A origem permanece somente leitura.

```powershell
python scripts/migration/export-xlsx.py scripts/migration/source/backup.xlsx scripts/migration/source/backup.json --spreadsheet-id 1fMcV6e2aUQ4y1zarOGZk0lbiNFTbkVTG
npm run migration:validate -- scripts/migration/source/backup.json
```

O download direto sem uma sessão Google autenticada retorna HTTP 401; por isso, o arquivo não deve ser obtido por um link público improvisado.

### 2. Aplicar o banco

Em uma cópia/homologação do projeto Supabase, antes da produção:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase test db
```

Nunca execute `supabase db reset --linked`: esse comando é destrutivo para um projeto remoto.

### 3. Ensaiar e carregar

O primeiro comando só valida. O segundo guarda a origem no staging, sem popular tabelas operacionais. O terceiro aplica e reconcilia:

```powershell
node --env-file=.env.migration.local scripts/migration/import-source.mjs scripts/migration/source/backup.json --dry-run
node --env-file=.env.migration.local scripts/migration/import-source.mjs scripts/migration/source/backup.json --stage-only
node --env-file=.env.migration.local scripts/migration/import-source.mjs scripts/migration/source/backup.json
```

A carga deve ser bloqueada se houver erro estrutural, checklist órfão, cobrança órfã ou JSON inválido. Duplicidade de contrato e campanha histórica ausente são avisos tratados sem descarte.

## Homologação antes do corte

- comparar contagens da origem, staging, mapa legado e destino;
- conferir amostras de cada contrato, aniversários, datas e valores;
- conferir todos os status de checklist e documentos extras;
- conferir três competências financeiras, pagamentos e confirmações de envio;
- conferir campanhas, destinatários, mensagens renderizadas e estados finais;
- testar concorrência com duas sessões, timeout e repetição do mesmo `operationId`;
- testar RLS com usuário sem permissão e com cada interface autorizada;
- executar o frontend contra Supabase primeiro em homologação;
- manter o Apps Script como leitura/fallback durante a janela de estabilização.

## Etapas ainda não autorizadas automaticamente

1. Aplicar as migrations no projeto remoto, pois a chave fornecida até agora é publishable e não administrativa.
2. Obter o XLSX autenticado do backup e executar a carga real.
3. Criar os usuários em Supabase Auth e seus registros em `profiles`.
4. Implementar o adaptador Supabase no frontend e operar em leitura espelhada.
5. Trocar `VITE_DATA_BACKEND` para `supabase` somente após reconciliação assinada.

O rollback do frontend é mudar a flag novamente para `gas`. Os dados importados permanecem auditáveis no Supabase e a planilha de backup não é modificada.
