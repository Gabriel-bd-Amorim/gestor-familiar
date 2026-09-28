# Configuração pelo usuário — Gestor financeiro familiar

## Status e finalidade

O MVP foi implementado. Este documento descreve as configurações reais da aplicação e o que você precisa fornecer para utilizá-la em seu servidor. Docker Compose, `.env.example`, migrações e scripts já estão disponíveis.

O MVP é manual: **você não precisa de token de banco para começar**. A chave da OpenAI também é opcional.

## 1. Preparar o servidor

- [ ] Instalar Docker Engine com o plugin Docker Compose no servidor, ou Docker Desktop para uso local.
- [ ] Reservar armazenamento persistente para o PostgreSQL e para backups.
- [ ] Definir o endereço pelo qual os usuários acessarão o sistema.
- [ ] Para acesso por outros dispositivos, configurar HTTPS no proxy reverso e um certificado confiável.
- [ ] Permitir acesso à aplicação conforme a rede privada/VPN utilizada; manter o PostgreSQL acessível apenas aos serviços que precisam dele.

Verificação das ferramentas:

```sh
docker --version
docker compose version
```

A instalação como PWA requer HTTPS, com exceção do desenvolvimento em `localhost`.

## 2. Preencher o arquivo `.env`

Para gerar automaticamente o `.env` com senhas e segredos aleatórios, execute na raiz do projeto (requer Node.js 22.12+):

```sh
npm run setup
```

Esse comando não precisa de `npm install` e não sobrescreve um arquivo existente. Se o `.env` já foi gerado nesta instalação, apenas confira os valores. A senha da primeira conta está em `INITIAL_ADMIN_PASSWORD`.

Alternativamente, copie `.env.example` para `.env` e preencha os valores manualmente.

### Variáveis obrigatórias

| Variável | O que você deve fornecer |
| --- | --- |
| `POSTGRES_DB` | Nome do banco, por exemplo `familia` |
| `POSTGRES_USER` | Usuário de banco exclusivo da aplicação |
| `POSTGRES_PASSWORD` | Senha forte e exclusiva para o PostgreSQL |
| `DATABASE_URL` | String de conexão compatível com as três variáveis acima |
| `AUTH_SECRET` | Segredo aleatório para a autenticação, com pelo menos 32 bytes de entropia |
| `INITIAL_ADMIN_USERNAME` | Nome de acesso da primeira conta administrativa |
| `INITIAL_ADMIN_PASSWORD` | Senha inicial forte; será trocada no primeiro acesso |
| `APP_URL` | Endereço completo da aplicação, incluindo `https://` quando hospedada |

### Variáveis de implantação

| Variável | Padrão e uso |
| --- | --- |
| `APP_PORT` | `3000`, porta exposta no servidor |
| `APP_BIND` | `127.0.0.1`, acesso local para proxy reverso; altere para o IP da rede privada se necessário |
| `TZ` | `America/Sao_Paulo`, usado para determinar o dia e mês atuais |

Para testar pela rede local sem proxy, ajuste `APP_BIND` e `APP_URL` para o IP/porta acessíveis. A instalação PWA em outros dispositivos e cookies seguros requerem HTTPS. `APP_URL` também valida a origem das consultas à IA; precisa coincidir com o endereço usado no navegador.

Exemplo ilustrativo — substitua todos os marcadores antes de usar:

```dotenv
POSTGRES_DB=familia
POSTGRES_USER=familia_app
POSTGRES_PASSWORD=<senha-do-banco>
DATABASE_URL=postgresql://familia_app:<senha-codificada-para-url>@postgres:5432/familia?schema=public
AUTH_SECRET=<segredo-aleatorio>
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=<senha-inicial>
APP_URL=https://financeiro.seu-dominio.com
```

`postgres` será o nome do serviço dentro da rede Docker, não um endereço público. Na `DATABASE_URL`, caracteres especiais de usuário e senha precisam de codificação percentual. A senha em `POSTGRES_PASSWORD` continua sendo o valor original.

### Gerar um segredo

Execute **uma** das opções abaixo e copie a saída para `AUTH_SECRET`.

Com OpenSSL:

```sh
openssl rand -hex 32
```

Com Windows PowerShell 5.1:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
```

Use senhas diferentes para o banco e o administrador. Guarde credenciais em um gerenciador de senhas. Não coloque o `.env` em repositórios nem compartilhe capturas que revelem chaves.

Alterar `AUTH_SECRET` invalida sessões. Alterar `POSTGRES_PASSWORD` no `.env` não redefine sozinho a senha de um banco já inicializado. Para rotacionar a senha do banco:

1. Faça backup e pare a aplicação: `docker compose stop app`.
2. Abra o cliente: `docker compose exec postgres psql -U familia_app -d familia`, ajustando os nomes para o seu `.env`.
3. Dentro do psql, use `\password familia_app`, informando o usuário correto, e digite a nova senha quando solicitado. Saia com `\q`.
4. Atualize `POSTGRES_PASSWORD` e `DATABASE_URL` no `.env`, mantendo a mesma senha e codificando caracteres especiais na URL.
5. Execute `docker compose up -d --force-recreate` e confira os health checks.

## 3. Ativar a IA, se desejar

- [ ] Criar uma chave de API no painel da OpenAI: <https://platform.openai.com/api-keys>.
- [ ] Conferir faturamento, créditos e limites de uso da conta de API.
- [ ] Escolher um modelo disponível para sua conta e compatível com a integração implementada.
- [ ] Preencher as variáveis opcionais e recriar o container da aplicação para aplicá-las.

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Deixe `OPENAI_API_KEY` vazia para iniciar sem IA. O modelo padrão é `gpt-4.1-mini`; você pode substituí-lo por um modelo compatível com Chat Completions e `max_completion_tokens`. Uma assinatura do ChatGPT não substitui a configuração e o faturamento da API.

Depois de alterar a configuração, execute `docker compose up -d --force-recreate app`. O limite implementado é de 15 tentativas por usuário por hora. O contexto usa no máximo 150 parcelas pendentes, informa quando há itens omitidos e não inclui observações privadas, senhas ou dados da conta/cartão. Cada pergunta é independente; as últimas consultas ficam no histórico do próprio usuário.

A chave será usada exclusivamente pelo servidor. Não deve ser colocada em variáveis públicas do frontend, como as prefixadas com `NEXT_PUBLIC_`.

Ao utilizar o assistente, um resumo dos dados financeiros autorizados do usuário será enviado à OpenAI. A interface indicará esse envio antes do uso. O assistente terá função de consulta e explicação, sem efetuar pagamentos.

## 4. Iniciar a aplicação e cadastrar os usuários

Com o `.env` preenchido, execute:

```sh
docker compose up -d --build
docker compose ps
docker compose logs app
```

Os comandos deverão ser executados na pasta que contém o arquivo Compose. Antes da primeira subida, confira o `.env` e o endereço de acesso.

- [ ] Aguardar o banco, as migrações e a inicialização da aplicação.
- [ ] Abrir a URL configurada em `APP_URL`.
- [ ] Entrar com `INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD`.
- [ ] Trocar a senha inicial.
- [ ] Criar uma conta separada para cada pessoa e entregar a senha temporária por um canal privado.
- [ ] Pedir que cada pessoa troque sua senha no primeiro acesso.

O serviço `migrate` aplica as migrações antes de a aplicação iniciar e cria o administrador somente se não houver usuários. É normal aparecer como encerrado com código 0. Reiniciar a aplicação ou alterar a variável de senha inicial não redefine uma conta existente. Depois da troca da senha inicial, você pode deixar `INITIAL_ADMIN_PASSWORD` vazia; ela só é obrigatória para inicializar um banco sem usuários.

Para publicar com um proxy reverso no próprio servidor, mantenha a porta ligada a `127.0.0.1` e encaminhe o tráfego HTTPS para `http://127.0.0.1:3000`. Preserve os cabeçalhos `Host` e `X-Forwarded-Proto`. Exemplo de Caddyfile, após apontar um domínio real para o servidor:

```caddyfile
financeiro.seu-dominio.com {
    reverse_proxy 127.0.0.1:3000
}
```

Defina `APP_URL=https://financeiro.seu-dominio.com` e recrie o serviço. Se o proxy também estiver em Docker, use uma rede compartilhada e o nome/porta do serviço em vez do loopback do container.

Não será necessário configurar e-mail, convites ou cadastro público para o fluxo aprovado.

## 5. Conferir o uso inicial

- [ ] Em **Salário e rendas**, registrar o salário líquido recebido, indicando a empresa como origem.
- [ ] Registrar outra renda, como freelance ou venda, com sua origem, valor e data.
- [ ] Conferir **Quanto sobra no mês?**: rendas + recebido das cobranças − compromissos integrais do mês (pagos e pendentes). A projeção inclui também cobranças a receber; o valor não é um saldo bancário.
- [ ] Criar uma compra privada parcelada e conferir valor, vencimento e `parcela atual / total`.
- [ ] Criar uma cobrança para outro usuário.
- [ ] Entrar na conta destinatária e conferir que somente a cobrança compartilhada aparece.
- [ ] Informar um pagamento parcial e conferir o saldo nas duas contas.
- [ ] Conferir que uma terceira pessoa não vê a cobrança nem a fatura original.
- [ ] Se a IA estiver ativa, solicitar um resumo da própria situação financeira.

A baixa informa que um pagamento foi realizado; ela não transfere dinheiro entre usuários. A transferência em si será feita fora da aplicação.

Rendas entram no mês do recebimento; cobranças e despesas entram pelo vencimento da parcela, incluindo as já pagas. Baixas e estornos ajustam o planejamento desse mesmo mês. Não cadastre a baixa de uma cobrança também como renda, para não duplicar a entrada. Registre o salário a cada recebimento: não há recorrência automática. Para corrigir renda, use **Corrigir recebimento** e cancele antes de recadastrar. Os registros são privados e cancelamentos ficam no histórico.

A migração `202609280001_income` adiciona a tabela de rendas preservando despesas, usuários e pagamentos existentes. Ela é aplicada pelo serviço `migrate` na atualização.

## 6. Backups e atualizações

- [ ] Definir frequência de backup e prazo de retenção conforme o uso.
- [ ] Manter cópia do banco em local separado do volume e, preferencialmente, do servidor.
- [ ] Guardar uma cópia protegida da configuração necessária para recuperação.
- [ ] Executar um teste de restauração antes de depender do sistema para uso contínuo.
- [ ] Antes de atualizar, realizar backup e consultar as instruções de migração da versão.

Volume Docker persistente não substitui backup. `docker compose down -v` remove os volumes do Compose e pode apagar o banco.

### Backup

Com Node.js disponível no host e os containers em execução:

```sh
npm run backup
```

O script usa `pg_dump` do próprio container e grava um arquivo binário `.dump` em `backups/`, sem corrompê-lo por redirecionamento de texto no PowerShell. O backup contém dados financeiros e hashes de senha; mantenha-o protegido. Copie-o para fora do servidor. Agende o comando pelo cron ou Agendador de Tarefas, com a pasta do projeto como diretório de trabalho.

Sem Node.js no host, crie o arquivo dentro do container e copie-o usando Docker (substitua usuário e banco se tiver alterado os padrões):

```sh
docker compose exec postgres pg_dump -Fc --no-owner -U familia_app -d familia -f /tmp/entrecontas.dump
docker compose cp postgres:/tmp/entrecontas.dump ./entrecontas.dump
```

### Restauração

A restauração **substitui o banco atual**. Faça um backup antes e prefira testar primeiro em uma instalação separada. O serviço PostgreSQL deve estar iniciado, com as credenciais corretas no `.env`.

```sh
npm run restore -- backups/arquivo.dump
```

O script para a aplicação, restaura em transação, aplica migrações, invalida sessões antigas e reinicia a aplicação. Se ocorrer um erro, confira a saída antes de reiniciar. A criação inicial de um banco completamente novo continua exigindo a senha inicial até a restauração ser feita.

### Atualização

1. Gere o backup e guarde o `.env` em local seguro.
2. Atualize os arquivos do projeto, preservando `.env` e volumes.
3. Execute:

```sh
docker compose build
docker compose stop app
docker compose run --rm migrate
docker compose up -d
docker compose ps
```

Só prossiga após cada comando concluir com sucesso. Caso a migração falhe, mantenha a aplicação parada e confira os logs. A versão anterior do código nem sempre é compatível com um banco migrado; use o backup para uma recuperação completa quando necessário.

## 7. Integração bancária futura

**Nenhuma destas credenciais é necessária no MVP.** Após escolher e implementar um provedor Open Finance, será necessário:

- [ ] Criar conta comercial/desenvolvedor no provedor escolhido.
- [ ] Obter as credenciais exigidas pelo provedor, como client ID e client secret.
- [ ] Configurar URLs de retorno e webhooks, se exigidos.
- [ ] Separar credenciais de teste das de produção.
- [ ] Configurar segredo de validação de webhooks e chave de criptografia dos tokens, quando aplicável.
- [ ] Cada titular autorizar voluntariamente a conexão de suas próprias contas pelo fluxo oficial.

Tokens de acesso serão obtidos e renovados pela integração conforme as regras do provedor; não se deve presumir que haverá um token permanente para colar no `.env`. Os nomes exatos das variáveis serão definidos nessa etapa.

Não será solicitado que usuários forneçam a senha do banco ao gestor familiar. A funcionalidade manual continuará disponível para quem não conectar uma conta.

## Resumo do que você precisa fornecer

| Item | Quando |
| --- | --- |
| Servidor com Docker e armazenamento persistente | Antes da implantação |
| URL de acesso e HTTPS para uso hospedado | Antes do acesso pelos usuários |
| Credenciais do banco e segredo de autenticação | Na configuração inicial |
| Usuário e senha do primeiro administrador | Na primeira inicialização |
| Contas individuais dos familiares | Pelo painel após a inicialização |
| Chave e modelo da OpenAI | Somente se quiser ativar IA |
| Local e rotina de backup | Antes do uso contínuo |
| Credenciais Open Finance | Somente após implementar a integração bancária |
