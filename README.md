# Documentação do Sistema IMG Imóveis

Este é o aplicativo interno de gerenciamento para a IMG Imóveis Mogi Guaçu. Ele utiliza uma interface construída em React e Tailwind CSS, e se comunica com o Google Sheets por meio do Google Apps Script.

## Configuração do Google Apps Script

A persistência de dados é feita no Google Sheets e as chamadas de backend são controladas por um script no Google Apps Script.
Para implantar uma nova versão do script ou começar do zero, siga os passos:

1. Acesse o [Google Apps Script](https://script.google.com/).
2. Crie um novo projeto ou selecione um existente.
3. Copie o conteúdo do arquivo `apps-script.js` (presente na raiz deste repositório) e cole no editor do Apps Script (normalmente chamado de `Código.gs`).
4. Altere a string do ID da planilha em `SpreadsheetApp.openById('SUA_PLANILHA_AQUI')` pelo ID real da sua planilha do Google Sheets.
5. Clique em **Implantar (Deploy) > Nova implantação**.
6. Selecione o tipo de implantação como **App da Web**.
7. Defina "Executar como" com a sua conta do Google (para que o script possa acessar a planilha).
8. Em "Quem tem acesso", escolha **Qualquer pessoa** (ou gerencie os acessos se necessário).
9. Clique em **Implantar** e copie a URL do Web App (termina em `/exec`).
10. Substitua o valor da constante `GAS_URL` no arquivo `src/store.ts` pela nova URL do seu Web App.

## Estrutura da Planilha

O Google Sheets deve conter as seguintes abas (caso não existam, o próprio Apps Script pode criá-las ao rodar `setupSpreadsheet()`):

- **Cadastros**
  Colunas: `id`, `dataHora`, `contrato`, `nomeProp`, `telProp`, `niverProp`, `nomeInq`, `telInq`, `niverInq`, `inicioContrato`, `fimContrato`, `corretor`, `diaVencimento`

- **Checklists**
  Colunas: `id`, `contrato`, `prop_contratoEnviado`, `prop_vistoriaEnviada`, `inq_manualEntregue`, `inq_vistoriaAssinada`, `inq_seguroIncendio`

- **Tarefas**
  Colunas: `idTarefa`, `dataConclusao`, `contrato`, `tipo`, `usuario`, `referencia`

## Notas Técnicas

- **Concorrência:** O Apps Script agora usa `LockService` para lidar com requisições concorrentes de forma mais segura.
- **Armazenamento:** A atualização, inclusão e remoção de dados ocorre através de chamadas HTTP POST com um payload JSON encapsulado num corpo de texto (Content-Type `text/plain`).
- **Verificações:** A interface checa as respostas HTTP para tratar os erros, com o `fetch` validando `response.ok`.
