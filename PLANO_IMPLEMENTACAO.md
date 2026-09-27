# Plano de implementação — Gestor financeiro familiar

## Status

MVP implementado em 27/09/2026. Os itens marcados foram entregues; a conexão bancária permanece como etapa futura. A chamada real à OpenAI depende de chave e créditos do usuário e ainda não foi validada com um provedor configurado.

Verificações executadas: build de produção, TypeScript, seis testes unitários, integração com PostgreSQL real em Docker, fluxo ponta a ponta com Firefox em desktop/celular e backup/restauração em ambiente descartável. As limitações do MVP estão no `README.md`.

## Objetivo e decisões aprovadas

Construir uma aplicação web responsiva, instalável como PWA, hospedada em servidor privado com Docker. Cada pessoa terá sua própria conta e seus dados financeiros privados.

- Cadastro manual de contas, faturas, compras e parcelas no MVP.
- Contas bancárias conectadas serão opcionais em uma etapa futura.
- Um administrador inicial será criado na primeira inicialização. Ele poderá cadastrar os demais usuários.
- Administrar usuários não concede acesso às finanças privadas deles pela aplicação.
- Cobranças compartilhadas entram automaticamente para o destinatário, sem aceite.
- O destinatário pode informar pagamentos totais ou parciais com baixa imediata, visível aos dois participantes.
- O painel mostra a parcela do mês e preserva o histórico.
- Assistente OpenAI opcional, limitado aos dados autorizados do usuário autenticado.

## Arquitetura prevista

| Camada | Tecnologia / responsabilidade |
| --- | --- |
| Aplicação | Next.js e TypeScript; interface e API |
| Persistência | PostgreSQL com Prisma e migrações versionadas |
| Autenticação | Usuário e senha, hash de senha e sessões em cookies seguros |
| Interface | Responsiva, acessível e instalável como PWA |
| Infraestrutura | Dockerfile de produção e Docker Compose |
| IA | API OpenAI chamada apenas pelo backend |
| Verificação | Vitest para regras críticas e testes de fluxo com Playwright |

### Serviços Docker

- `app`: aplicação.
- `postgres`: banco com volume persistente.
- Etapa controlada de migração e criação idempotente do administrador antes de disponibilizar a aplicação.
- Health checks e política de reinício.
- HTTPS fornecido pelo proxy reverso do servidor.

## Regras financeiras e de privacidade

### Dados pessoais

Contas, cartões, faturas, compras, categorias pessoais, observações e conversas com a IA pertencem ao usuário que os criou. A autorização será aplicada no backend, inclusive em listagens, detalhes, alterações e contexto enviado à IA.

O administrador gerencia acesso e contas de usuário. Não haverá uma tela administrativa que permita consultar as finanças de outras pessoas. O operador do servidor e do banco tem acesso técnico à infraestrutura; essa separação de permissões na aplicação não equivale a criptografia ponta a ponta.

### Cobranças compartilhadas

1. O usuário 1 cria uma cobrança para o usuário 2, opcionalmente a partir de um lançamento privado.
2. A cobrança aparece para ambos automaticamente.
3. São compartilhados somente os campos necessários: participantes, descrição compartilhada, valor, vencimento, parcelas e histórico de pagamentos.
4. A fatura de origem, o cartão e as observações privadas não são expostos ao destinatário.
5. O usuário 2 informa o pagamento, integral ou parcial, e o saldo é atualizado imediatamente para os dois.
6. Registrar uma baixa documenta um pagamento informado; o sistema não movimenta dinheiro nem confirma uma transferência bancária.
7. Correções de pagamento usam estorno com trilha de auditoria, sem apagar o registro original.

Somente os dois participantes podem acessar a cobrança. O criador pode cancelar a cobrança segundo regras que preservem os pagamentos já registrados. Alterações de valor, cancelamentos e estornos devem ficar visíveis no histórico compartilhado.

### Parcelas

- Suportar descrição, valor total ou valor da parcela, quantidade total, primeira parcela a acompanhar, data da compra e primeiro vencimento.
- Permitir acompanhar compras já em andamento, sem presumir que parcelas anteriores foram pagas.
- Gerar uma programação persistida de parcelas e apresentar `parcela atual / total`, por exemplo `3/10`.
- Calcular a parcela do mês a partir das datas; a mudança de mês não depende de abrir a aplicação nem marca pagamentos automaticamente.
- Preservar parcelas anteriores, inclusive vencidas e não pagas.
- Tratar vencimentos em meses sem o dia escolhido usando o último dia válido do mês.
- Armazenar dinheiro em centavos ou decimal exato; distribuir arredondamentos sem alterar o total da compra.
- Distinguir valor vencido, saldo pendente, saldo futuro e total efetivamente pago.
- Definir explicitamente a parcela à qual cada pagamento se refere, com tratamento transacional para evitar abatimentos duplicados ou acima do saldo.
- Evitar dupla contagem de compras, faturas e cobranças vinculadas nos totais do painel.

## Etapas e critérios de aceite

### 1. Base e infraestrutura

- [x] Inicializar Next.js, TypeScript, Prisma e PostgreSQL.
- [x] Criar Dockerfile, Compose, health checks e volume persistente.
- [x] Criar `.env.example` e ignorar arquivos locais de segredos no Git.
- [x] Implementar migrações controladas e inicialização idempotente.

**Aceite:** uma instalação limpa sobe em Docker; reiniciar ou recriar o container da aplicação preserva os dados.

### 2. Autenticação e usuários

- [x] Criar administrador inicial com credenciais de ambiente.
- [x] Evitar recriação ou redefinição de senha do administrador em reinicializações.
- [x] Implementar login, logout, expiração e invalidação de sessões.
- [x] Implementar criação e desativação de usuários pelo administrador.
- [x] Exigir troca da senha temporária no primeiro acesso e permitir redefinição administrativa.
- [x] Proteger formulários e endpoints de mutação; limitar tentativas de login.

**Aceite:** cada pessoa acessa sua própria conta; usuário desativado perde acesso; administrador não recebe acesso financeiro adicional.

### 3. Finanças privadas e parcelas

- [x] Criar contas, cartões e lançamentos manuais para compras/faturas, com categorias predefinidas.
- [x] Permitir descrição da origem e observações privadas.
- [x] Implementar programação de parcelas e compras em andamento.
- [x] Implementar pagamento e histórico dos lançamentos privados.
- [x] Implementar correção por cancelamento e novo cadastro, preservando o histórico (sem edição destrutiva).

**Aceite:** compras parceladas aparecem no mês correto, com total exato e histórico preservado; outro usuário não consegue consultar nem alterar esses registros.

### 4. Cobranças entre usuários

- [x] Criar cobrança independente ou vinculada a um lançamento privado.
- [x] Exibir automaticamente para o destinatário.
- [x] Implementar pagamentos parciais e totais com baixa imediata.
- [x] Implementar estorno e auditoria com autor, data e ação.
- [x] Atualizar a visualização dos dois participantes sem exigir novo login (até 15 segundos em tela ativa).
- [x] Proteger contra envio duplicado e atualizações concorrentes.

**Aceite:** pagamento parcial reduz o mesmo saldo para os dois usuários; um terceiro não acessa a cobrança; nenhum detalhe privado da fatura original é exposto.

### 5. Painel e experiência móvel

- [x] Mostrar valores a pagar no mês, a receber, vencidos e próximos vencimentos.
- [x] Mostrar parcela atual, pagamentos recentes e distribuição por categoria.
- [x] Adicionar histórico mensal e projeção de parcelas futuras.
- [x] Implementar layout responsivo, acessibilidade básica e estados vazios.
- [x] Adicionar manifest e ícones para instalação PWA em navegadores compatíveis.
- [x] Evitar cache offline de respostas financeiras e sessões (aplicação online, sem service worker de cache).

**Aceite:** principais fluxos funcionam no celular e no computador; painel respeita o usuário e o mês selecionados.

### 6. Assistente financeiro opcional

- [x] Habilitar interface OpenAI quando houver chave; tratar erros de configuração na consulta.
- [x] Montar contexto estruturado e mínimo no backend com dados autorizados.
- [x] Exigir consentimento antes do envio de dados ao provedor.
- [x] Preparar resumo do mês, vencimentos, parcelas futuras e recebíveis para consulta.
- [x] Implementar tratamento de indisponibilidade, limite de 15 consultas/hora e erros sem bloquear a aplicação.
- [x] Manter conversas privadas; não permitir que a IA execute SQL ou altere pagamentos.
- [ ] Validar resposta real da OpenAI após o usuário configurar chave, modelo e créditos.

**Aceite:** aplicativo funciona sem chave; IA usa apenas dados pessoais e cobranças permitidas ao usuário autenticado.

### 7. Verificação e entrega

- [x] Testar isolamento entre usuários, inclusive tentativas por IDs de registros alheios.
- [x] Testar arredondamento, fim de mês, virada de ano e parcelas em andamento.
- [x] Testar baixa parcial, integral, duplicada, concorrente e estorno.
- [x] Verificar login, criação de usuário e cobrança entre duas contas no navegador Firefox.
- [x] Executar build de produção e validar inicialização Docker.
- [x] Documentar e testar backup e restauração do PostgreSQL.
- [x] Atualizar `CONFIGURACAO_USUARIO.md` com comandos e variáveis reais da implementação.

**Aceite:** verificações críticas passam e uma instalação nova pode ser realizada seguindo a documentação.

## Etapa futura — conexão bancária opcional

- [ ] Escolher agregador compatível com o país e instituições usadas.
- [ ] Configurar credenciais, ambientes de teste/produção e consentimento individual.
- [ ] Implementar conexão e desconexão pelo próprio titular.
- [ ] Importar transações com identificadores externos e prevenção de duplicidade.
- [ ] Conciliar importações com lançamentos manuais, sem duplicar despesas.
- [ ] Proteger tokens e validar webhooks conforme a documentação do provedor.

A conexão de uma pessoa nunca dará acesso aos dados bancários das demais. O uso manual continuará disponível.
