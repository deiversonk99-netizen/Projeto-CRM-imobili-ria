# CRM IMG Imóveis

Aplicação interna para contratos, aniversários, checklists, cobranças, condomínios e campanhas manuais de WhatsApp. O frontend usa React/Vite; o backend é um Web App do Google Apps Script com Google Sheets.

## Requisitos

- Node.js 22.22.2
- npm 11
- uma planilha Google dedicada ao sistema
- um projeto Google Apps Script implantado como Web App

## Desenvolvimento local

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Preencha `VITE_GAS_URL` em `.env.local` com a URL `/exec` da implantação de homologação. Nunca use a planilha de produção para testes automatizados.
O projeto não possui URL de produção embutida: sem essa variável, as chamadas são bloqueadas com `CONFIG_ERROR`.

Antes de publicar:

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

## Configuração inicial do Apps Script

1. Copie todo o conteúdo de `apps-script.js` para o editor do Google Apps Script.
2. Nas **Propriedades do script**, crie `SPREADSHEET_ID` com o ID da planilha. O arquivo não contém um ID de produção como fallback.
3. Execute manualmente `setupSpreadsheet()` e autorize o script. A rotina cria as abas e acrescenta colunas ausentes sem substituir cabeçalhos existentes.
4. Durante a troca de versão, backend e frontend usam um modo de transição compatível enquanto `APP_AUTH_CONFIGURED` não estiver definido como `true`; isso evita indisponibilidade entre o deploy do Apps Script, a atualização da Vercel e caches antigos da PWA.
5. Execute uma única vez `setupAuth('admin', 'uma-senha-forte', 'Administrador', 'email@empresa.com')`. A senha deve ter pelo menos dez caracteres e é armazenada somente como hash com salt. Essa execução encerra automaticamente o modo de transição.
5. Implante como **App da Web**, executando como o proprietário, e copie a URL terminada em `/exec` para `VITE_GAS_URL` na Vercel.
6. Faça primeiro uma implantação de homologação usando uma cópia da planilha e valide os fluxos abaixo. Só depois publique a mesma versão em produção.

Uma nova implantação do Apps Script e um novo deploy da Vercel são partes distintas. Atualizar apenas o GitHub não atualiza o backend.

## Migração e validação

Antes de executar `setupSpreadsheet()` em produção:

1. faça uma cópia completa da planilha;
2. registre o ID e a versão atual da implantação;
3. execute a migração na cópia;
4. confira cabeçalhos e contagem de linhas;
5. teste criar/editar/arquivar contrato, checklist, cobrança e campanha;
6. publique em produção e preserve o backup.

As tabelas principais são `Cadastros`, `Checklists`, `Tarefas`, `Condominios`, `Cobrancas`, `Campanhas`, `Campanha_Destinatarios`, `Campanha_Operacoes` e `Operacoes`. Não reordene nem renomeie cabeçalhos manualmente.

## Campanhas e WhatsApp

- O envio continua humano: **Abrir WhatsApp** prepara a mensagem; **Confirmar envio** registra a confirmação.
- Cada destinatário é deduplicado por telefone normalizado dentro da campanha.
- Operações de criação, início, edição e confirmação usam UUID persistente para suportar timeout e retentativa.
- **Desativar** pausa uma campanha sem apagar destinatários ou histórico. **Reativar** restaura a operação com o mesmo estado. Campanhas arquivadas ou canceladas são finais e não podem ser reativadas.
- Uma campanha inativa não pode ser iniciada nem ter destinatários atualizados.

## Recuperação de falhas

- Erros de timeout não significam necessariamente que a gravação falhou. Retente pelo mesmo botão para reaproveitar a chave idempotente.
- Conflitos de versão devem ser reconciliados com os dados mais novos antes de sobrescrever.
- Checklists com `documentos_json` inválido entram em modo protegido e não são salvos. Restaure o JSON a partir do backup antes de continuar.
- Duplicidades financeiras não são escondidas pela interface; a origem deve ser corrigida na planilha/backend.
- Ao sair da conta, filas locais e tokens são apagados.

## Segurança operacional

- Não versione `.env.local`, senhas, tokens, IDs privados ou cópias de planilhas.
- Revogue a implantação anterior se a URL tiver sido exposta.
- Use contas separadas para homologação e produção quando possível.
- Faça backup periódico da planilha e teste a restauração.
- O Google Sheets continua sendo uma limitação para alta concorrência. Para crescimento multiusuário ou dados financeiros críticos, planeje a migração para um banco transacional.
