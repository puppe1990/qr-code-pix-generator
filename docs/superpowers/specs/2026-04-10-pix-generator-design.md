# Design: melhoria do gerador de QR Code Pix

Data: 2026-04-10

## Objetivo

Melhorar o gerador atual sem aumentar o escopo funcional além do necessário.
O foco é corrigir o principal problema de uso: ausência de seleção explícita do tipo de chave Pix e falta de validação orientada por tipo.

## Escopo

Esta versão permanece simples.

Inclui:

- seletor explícito de tipo de chave Pix com as opções `CPF`, `CNPJ`, `E-mail`, `Telefone` e `Aleatória`
- placeholder dinâmico no campo de chave conforme o tipo selecionado
- validação básica por tipo antes de gerar o payload
- normalização da chave para o formato esperado pelo payload
- abertura de modal ao gerar o QR Code com sucesso
- exibição do QR Code e do campo `Pix copia e cola` dentro da modal
- botão para copiar o código Pix
- botão para fechar a modal
- exibição do valor na modal apenas quando informado

Não inclui:

- descrição do pagamento
- TXID customizado
- fluxo em múltiplas etapas
- detecção automática do tipo da chave
- persistência de histórico

## Experiência do usuário

O usuário preenche um formulário simples na tela principal.
Antes do campo da chave Pix, haverá um seletor de tipo.
Ao mudar o tipo, o formulário atualiza o placeholder da chave e passa a validar a entrada com as regras daquele tipo.

Quando a geração for bem-sucedida:

- o QR Code não aparece inline na página
- uma modal central é aberta sobre a interface
- a modal mostra o QR Code, o código copia e cola, o valor quando existir, e ações de copiar e fechar

Quando houver erro:

- a modal não abre
- o erro aparece no próprio formulário, de forma curta e direta

## Regras de validação

### CPF

- aceitar entrada com ou sem máscara
- normalizar para apenas dígitos
- exigir exatamente 11 dígitos

### CNPJ

- aceitar entrada com ou sem máscara
- normalizar para apenas dígitos
- exigir exatamente 14 dígitos

### E-mail

- remover espaços laterais
- validar formato básico de e-mail

### Telefone

- aceitar entrada com espaços, parênteses e hífens
- normalizar removendo pontuação e espaços
- aceitar formato brasileiro com DDI, priorizando `+55`
- rejeitar entrada vazia ou claramente fora do padrão de telefone Pix

### Aleatória

- aceitar texto livre não vazio
- usar valor normalizado com trim

## Estrutura técnica

O código será reorganizado para separar responsabilidades:

- um módulo de lógica para normalização, validação e geração do payload Pix
- um módulo de interface para eventos do formulário, mensagens de erro, modal e geração visual do QR Code

Como o projeto hoje está em arquivo único de script, a separação pode continuar no mesmo arquivo nesta etapa, desde que as funções fiquem claramente isoladas por responsabilidade e sejam testáveis sem depender do DOM.

## Geração do payload

O payload continuará seguindo a estrutura EMV usada no projeto atual.
O valor continuará opcional.
Os campos `nome do recebedor` e `cidade` permanecem obrigatórios.

Antes de montar o payload:

- a chave passa pela normalização por tipo
- a validação deve acontecer antes da geração do QR Code
- em caso de falha, a geração é interrompida

## Modal de resultado

A modal deve:

- abrir apenas após geração válida
- bloquear visualmente o fundo com overlay
- permitir fechamento por botão visível
- preencher o campo `Pix copia e cola` com o payload gerado

Desejável nesta etapa:

- fechar também com tecla `Escape`
- impedir que o conteúdo da modal abra vazio em caso de erro

## Testes

Cobertura mínima automatizada:

- geração de payload com chave do tipo `CPF`
- geração de payload com chave do tipo `CNPJ`
- geração de payload com chave do tipo `E-mail`
- geração de payload com chave do tipo `Telefone`
- geração de payload com chave do tipo `Aleatória`
- inclusão do valor quando informado
- rejeição de entradas inválidas por tipo

Verificação manual mínima:

- troca do tipo altera placeholder corretamente
- erro aparece sem abrir a modal quando a chave é inválida
- sucesso abre a modal com QR Code e cópia e cola preenchidos
- botão de copiar continua funcionando
- botão de fechar encerra a modal corretamente

## Restrições

- manter a interface enxuta
- não transformar o fluxo em wizard
- não adicionar campos além de tipo de chave, chave, nome, cidade e valor
- preservar a simplicidade do projeto atual

## Riscos e mitigação

Risco: validação frouxa demais para telefone gerar payload inconsistente.
Mitigação: aplicar normalização previsível e validação mínima explícita para formato brasileiro.

Risco: mistura de lógica de DOM com lógica de payload dificultar testes.
Mitigação: extrair funções puras para validação, normalização e montagem do payload.

Risco: modal abrir sem dados válidos.
Mitigação: condicionar a abertura exclusivamente ao caminho de sucesso após validação e geração.
