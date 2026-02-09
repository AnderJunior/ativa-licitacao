# Checkbox "Revisão" (Cadastro de Licitações)

## Regra de negócio

O checkbox **Revisão** na tela de cadastro de licitações deve ser marcado **somente** quando:

1. A licitação **já está cadastrada**, e  
2. A licitação **já foi enviada em relatório para o cliente**.

## O que NÃO define o checkbox

- **Não** é marcado apenas por a licitação estar cadastrada.
- Ou seja: cadastro sozinho não basta; é obrigatório que a licitação tenha sido **enviada em relatório ao cliente** para o checkbox Revisão ser marcado.

## Implementação

- Na interface, o estado é derivado de `cadastrado === true && enviada === true` (dados da licitação).
- Ao carregar uma licitação (por ID ou pela busca), o checkbox é preenchido com base nessa condição.
- Ao limpar o formulário, o checkbox Revisão é desmarcado.

## Referência no código

- Estado e checkbox: `src/pages/licitacoes/Cadastro.tsx` (estado `revisao`, componente Checkbox "Revisão").
- Definição ao carregar: `loadContratacao` e `handleLicitacaoEncontrada`.
- Limpeza: `handleLimpar`.
