# Entrecontas

Gestor financeiro familiar privado, responsivo e executado em Docker. Cada pessoa tem seu próprio acesso; somente cobranças explicitamente direcionadas a outra pessoa são compartilhadas.

## Começar

Requisitos: Docker com Compose. Node.js 22.12+ é necessário apenas para scripts locais e desenvolvimento.

```sh
npm run setup
docker compose up -d --build
```

Abra **http://localhost:3000**. O usuário inicial é `admin`; a senha aleatória está em `INITIAL_ADMIN_PASSWORD` no `.env` criado pelo setup. Troque-a no primeiro acesso. O setup não substitui um `.env` existente.

Também é possível configurar o `.env` manualmente a partir de `.env.example`, sem Node.js no servidor. Consulte [CONFIGURACAO_USUARIO.md](CONFIGURACAO_USUARIO.md).

## Funcionalidades

- Login com sessão de sete dias, troca obrigatória de senha inicial e limitação de tentativas.
- Administrador cria usuários, redefine senhas temporárias e desativa acessos.
- Contas, cartões e lançamentos privados, com descrição, categoria e observações.
- Parcelas com valores exatos, compra em andamento, vencimentos e histórico.
- Cobranças entre dois usuários, com baixa imediata, pagamento parcial, estorno e auditoria.
- Painel por mês, valores vencidos, categorias, recebíveis e projeção de seis meses.
- Salário e outras rendas privadas, com origem, valor líquido, data de recebimento e planejamento mensal.
- Assistente opcional da OpenAI, com consentimento por consulta, histórico privado e limite de uso.
- Manifest e ícones para instalação como aplicativo em navegadores compatíveis; requer conexão, sem cache offline de dados financeiros.
- PostgreSQL persistente, migrações, health checks e scripts de backup/restauração.

## Como usar

1. Em **Usuários**, o administrador cria uma conta para cada familiar.
2. Em **Contas e cartões**, cada pessoa cadastra os nomes que utiliza para organização.
3. Em **Novo lançamento → Despesa privada**, registra uma compra ou uma fatura manualmente.
4. Informa o total de parcelas, a primeira a acompanhar e seu vencimento. Para acompanhar `3/10`, informe total `10`, primeira `3` e vencimento da terceira parcela. O valor total deve representar a compra inteira; alternativamente informe o valor de cada parcela.
5. Em **Cobrar alguém**, escolhe o destinatário e escreve uma descrição que ele poderá ver. A vinculação opcional à despesa original é visível apenas ao criador.
6. Cada parcela possui **Registrar pagamento**. O saldo é abatido imediatamente para os envolvidos; a outra tela atualiza em até 15 segundos quando visível e sem campo em edição, ou ao recarregar.
7. Erros são corrigidos por estorno do autor do pagamento. Para corrigir uma compra, cancele e recadastre; pagamentos ativos precisam ser estornados primeiro.

**Baixas são registros manuais, não transferências bancárias.** A cobrança não paga automaticamente a despesa original: o pagamento recebido e a quitação do cartão são acontecimentos diferentes. Não cadastre o mesmo gasto simultaneamente como compra e como fatura integral se não quiser duplicar seus compromissos.

### Salário, outras rendas e quanto sobra

Em **Salário e rendas**, registre cada recebimento: tipo (salário ou outra renda), origem (empresa, freelance, venda, benefício etc.), valor líquido, data e observações opcionais. É possível registrar vários recebimentos, como adiantamento e restante do salário. Use o seletor de mês para consultar o histórico. Para corrigir um erro, abra **Corrigir recebimento**, cancele o registro e cadastre o correto; o histórico é preservado.

O painel calcula **saldo do planejamento = salário + outras rendas + recebido das cobranças do mês − todos os compromissos do mês**. Saldo negativo indica quanto falta. A projeção acrescenta as cobranças ainda pendentes de recebimento. Por exemplo: R$ 3.000 de salário + R$ 500 de freelance − R$ 2.000 de compromissos = R$ 1.500 de sobra.

As rendas são agrupadas pela data de recebimento; despesas e cobranças, pelo mês de vencimento da parcela. Uma baixa ou estorno recalcula o planejamento desse mês, mesmo se registrado em outro mês. Pagar uma despesa não aumenta a sobra: ela já faz parte dos compromissos. Não recadastre cobranças recebidas como renda, pois suas baixas já entram no cálculo.

É um planejamento mensal, não saldo bancário: não transporta saldo inicial, sobras ou dívidas anteriores (pendências anteriores são avisadas separadamente). Salário não é repetido automaticamente; registre cada recebimento real. Cada usuário vê apenas suas rendas, inclusive em relação aos administradores. O resumo da IA, quando autorizado, também considera os totais das rendas e do planejamento.

## Limites desta versão

- Cadastro manual; Open Finance é uma etapa futura.
- Faturas são acompanhadas como lançamentos; não há importação de extrato, cálculo automático de fechamento de cartão ou leitura de PDF.
- Uma despesa pode originar uma cobrança vinculada. Para dividir entre várias pessoas, crie cobranças independentes.
- Categorias predefinidas; sem orçamento por categoria ou conciliação de saldo bancário. Rendas são registradas manualmente, sem recorrência automática.
- Sem comprovantes anexados, e-mail ou notificações push.
- A IA é somente consultiva. A conexão real com a OpenAI depende da sua chave, modelo e créditos.

## Comandos

```sh
docker compose ps
docker compose logs --tail=100 app migrate
docker compose stop
docker compose start
npm run backup
npm run restore -- backups/arquivo.dump
```

A restauração substitui os dados atuais, para a aplicação durante a operação e invalida sessões. O procedimento completo está em [CONFIGURACAO_USUARIO.md](CONFIGURACAO_USUARIO.md).

## Instalação no ZimaOS com atualização automática

O instalador clona o repositório, gera o `.env` com segredos aleatórios, sobe os contêineres na porta **3210** e registra no `cron` a verificação do GitHub a cada 10 minutos. Ao detectar um commit novo, ele salva um `pg_dump`, move o código para `origin/main`, reconstrói as imagens e sobe a nova versão (as migrações do Prisma rodam sozinhas pelo serviço `migrate`).

Execute no host, como root:

```sh
git clone https://github.com/Gabriel-bd-Amorim/gestor-familiar /DATA/AppData/gestor-familiar
cd /DATA/AppData/gestor-familiar
sh deploy/install.sh
```

O instalador imprime o usuário e a senha iniciais e os grava em `/DATA/AppData/gestor-familiar/install-credentials.txt` (modo `600`). Para fixar a senha inicial ou trocar a porta, defina as variáveis antes de rodar:

```sh
APP_PORT=3210 INITIAL_ADMIN_PASSWORD='sua-senha' sh deploy/install.sh
```

Acompanhar e forçar uma atualização:

```sh
sh deploy/status.sh
tail -f /var/log/gestor-familiar-autoupdate.log
APP_DIR=/DATA/AppData/gestor-familiar sh scripts/auto-update.sh
```

`deploy/status.sh` compara o commit do servidor com o do GitHub, mostra a saúde do contêiner, a URL, os backups e as últimas linhas do log de atualização.

O `.env` e `backups/` são ignorados pelo Git, então `git reset --hard` durante a atualização nunca apaga segredos nem dumps do banco. Para desativar a atualização automática, remova a linha do `crontab` que menciona `scripts/auto-update.sh`.

## Verificação

```sh
npm ci
npm run typecheck
npm test
npm run build
npm audit
```

Testes de integração, em um PostgreSQL descartável e separado:

```sh
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f compose.test.yaml down
```

Teste ponta a ponta com Firefox (o banco de navegador precisa estar limpo a cada execução):

```sh
docker compose -f compose.browser.yaml down
docker compose -f compose.browser.yaml up -d --build
npx playwright install firefox
npm run test:e2e
docker compose -f compose.browser.yaml down
```

O ambiente de navegador usa `localhost:3101`, credenciais exclusivas de teste e dados descartáveis. Não é configuração de produção. Screenshots e traces são gravados em `test-results/`, ignorado pelo Git.

## Estrutura

```text
app/                  Páginas, ações de servidor e endpoints
components/           Formulários, navegação e assistente
lib/                  Autenticação, cálculos e autorização financeira
prisma/               Modelo e migrações versionadas
scripts/              Inicialização, configuração, ícones, backup e auto-update
tests/                Regras financeiras, integração e navegação Firefox
public/               Ícones PWA
deploy/               Instalador e consulta de estado do ZimaOS
compose.yaml          Ambiente principal
compose.test.yaml     Integração isolada
compose.browser.yaml  Ambiente descartável de navegação
```

O estado das etapas e a arquitetura estão em [PLANO_IMPLEMENTACAO.md](PLANO_IMPLEMENTACAO.md).
