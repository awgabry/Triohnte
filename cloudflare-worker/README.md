# Notificações Push do Triohnte (Cloudflare Worker)

## O que este serviço faz
- Recebe eventos do Fórum enviados por utilizadores autenticados no Firebase.
- Confirma a sessão com o Firebase Identity Toolkit e confirma que o autor é dono da publicação.
- Lê os tokens FCM e envia notificações através da API HTTP v1 do Firebase.
- Usa Cloudflare KV para impedir que o mesmo evento dispare notificações repetidas.

## 1. Criar o Worker e o KV
1. Entre em https://dash.cloudflare.com/ e abra **Workers & Pages**.
2. Crie um Worker chamado `triohnte-push`.
3. No separador **Storage & databases > KV**, crie um namespace chamado `TRIOHNTE_PUSH_DEDUPE`.
4. Abra o Worker > Settings > Bindings > Add > KV namespace. Nome da variável: `PUSH_DEDUPE`. Escolha o namespace criado.
5. Copie o ID do namespace e substitua `SUBSTITUIR_PELO_ID_DO_KV` em `wrangler.toml`, caso use Wrangler. No painel, não precisa do wrangler.toml.

## 2. Criar a credencial privada do Firebase
1. Abra Google Cloud Console > projeto `triohnte-database` > IAM & Admin > Service Accounts.
2. Use uma conta de serviço dedicada para o Worker (não use uma conta pessoal).
3. Conceda apenas as permissões necessárias para Firebase Cloud Messaging e leitura da Realtime Database. A conta precisa conseguir chamar FCM HTTP v1 e ler `fcmTokens`, `posts` e `novidades_publicas`.
4. Gere uma chave JSON para essa conta. **Não envie esse JSON no chat, não o coloque no GitHub e não o partilhe.**
5. No Worker > Settings > Variables and Secrets > Add variable, crie um Secret chamado `FIREBASE_SERVICE_ACCOUNT_JSON` e cole o JSON completo da conta de serviço.

## 3. Publicar o código
1. No Worker, abra **Edit code**.
2. Copie o conteúdo de `src/index.js` deste repositório e publique (**Deploy**).
3. Confirme que o binding KV se chama exatamente `PUSH_DEDUPE`.
4. Copie o endereço do Worker, por exemplo `https://triohnte-push.<sua-conta>.workers.dev`.

## 4. Ligar o endereço ao site
No `index.html`, substitua `COLOQUE_A_URL_DO_WORKER_AQUI` pela URL real do Worker, sem barra no final. Faça commit e aguarde a publicação do GitHub Pages.

## 5. Ativar no dispositivo
1. Abra o Triohnte publicado e entre na sua conta.
2. Abra **Novidades** e clique em **Ativar notificações neste dispositivo**.
3. Autorize as notificações do Chrome.
4. Repita em cada dispositivo/navegador onde deseja receber push.

## Importante sobre o painel Admin
O painel atual usa um código local no JavaScript, não uma autenticação Firebase verificável pelo servidor. Por segurança, o Worker não aceita pedidos de envio originados apenas desse código. As novidades publicadas pelo Admin continuam a aparecer na central em tempo real; para enviar push dessas novidades, o painel Admin precisa primeiro de passar a autenticar-se com Firebase Auth e, idealmente, usar uma permissão administrativa verificada no servidor.

## Limitações
- Push é uma notificação do sistema operativo, não uma garantia de contador numérico no ícone quando a app está fechada. Isso depende do Chrome e do sistema operativo.
- O Worker e KV têm planos gratuitos com limites de utilização; o uso acima desses limites pode exigir pagamento.
- Não exponha a chave privada da conta de serviço. Se ela vazar, revogue-a imediatamente.

## 6. Regras da Realtime Database para os tokens

Antes de testar, confira as regras atuais da Realtime Database. **Não substitua o conjunto inteiro de regras sem mesclar com as regras que o site já utiliza.** Dentro de `rules`, adicione este ramo:

```json
"fcmTokens": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid"
  }
}
```

Isso permite que cada utilizador leia e atualize apenas os próprios tokens. O Worker usa a credencial de serviço guardada como Secret para ler os tokens no servidor.

Se as regras atuais tiverem permissões herdadas em níveis superiores, elas podem sobrepor esta proteção; revise a árvore completa antes de publicar.
