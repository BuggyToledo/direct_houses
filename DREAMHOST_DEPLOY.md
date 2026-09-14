# 🚀 Guia de Implantação no DreamHost

Guia passo a passo para hospedar o **Assistente Comercial Direct Houses** no **DreamHost** sob o domínio **`https://direct.icone-rio.com.br`**, incluindo a configuração do **Google Sign-In** e do **WhatsApp Web 24/7**.

---

## 📋 Sumário
1. [Requisitos Prévios](#1-requisitos-prévios)
2. [Configurar o Google OAuth (Google Cloud Console)](#2-configurar-o-google-oauth-google-cloud-console)
3. [Configurar o Subdomínio e SSL no DreamHost](#3-configurar-o-subdomínio-e-ssl-no-dreamhost)
4. [Instalação e Configuração via SSH no Servidor](#4-instalação-e-configuração-via-ssh-no-servidor)
5. [Variáveis de Ambiente (`.env`)](#5-variáveis-de-ambiente-env)
6. [Execução em Segundo Plano com PM2 (Recomendado)](#6-execução-em-segundo-plano-com-pm2-recomendado)
7. [Configuração do Proxy Reverso com WebSockets](#7-configuração-do-proxy-reverso-com-websockets)
8. [Primeiro Acesso e Gerenciamento de Usuários](#8-primeiro-acesso-e-gerenciamento-de-usuários)
9. [Backup e Manutenção](#9-backup-e-manutenção)

---

## 1. Requisitos Prévios

- Acesso ao painel do **DreamHost** (VPS ou Dedicado com suporte a Node.js).
- Acesso SSH ao servidor DreamHost.
- Node.js versão **18.x** ou **20.x+** e npm instalados no servidor.
- Domínio `icone-rio.com.br` apontado para o DreamHost.
- Chave de API do **Google Gemini** ([Google AI Studio](https://aistudio.google.com/)).

---

## 2. Configurar o Google OAuth (Google Cloud Console)

Para que o login com Contas Google funcione no domínio `https://direct.icone-rio.com.br`:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto ou selecione um existente (ex: `Direct Houses Assistant`).
3. Vá em **APIs e Serviços** > **Tela de permissão OAuth** (OAuth Consent Screen):
   - Tipo de Usuário: **Externo** (ou **Interno** se possuir Google Workspace corporativo).
   - Nome do Aplicativo: `Assistente Comercial Direct Houses`.
   - E-mail para suporte: `toledo@icone-rio.com.br`.
   - Salve as configurações.
4. Vá em **APIs e Serviços** > **Credenciais** > **Criar Credenciais** > **ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Nome: `Direct Houses Web App`.
   - **Origens JavaScript autorizadas** (Authorized JavaScript origins):
     - `https://direct.icone-rio.com.br`
     - `http://localhost:3000` *(para testes locais)*
   - **URIs de redirecionamento autorizados**:
     - `https://direct.icone-rio.com.br`
     - `http://localhost:3000`
5. Clique em **Criar** e copie o **ID do cliente** gerado (ex: `1234567890-abcdef.apps.googleusercontent.com`).

---

## 3. Configurar o Subdomínio e SSL no DreamHost

1. No Painel DreamHost, vá em **Websites** > **Manage Websites**.
2. Clique em **Add Website** ou **Add Subdomain**:
   - Domínio: `direct.icone-rio.com.br`
   - Usuário SSH: seu usuário do servidor.
3. Ative o certificado SSL gratuito (**Let's Encrypt**):
   - Vá em **Security** > **SSL/TLS Certificates**.
   - Ative o certificado Let's Encrypt para `direct.icone-rio.com.br` e force o redirecionamento HTTPS.
   > ⚠️ **Importante**: O HTTPS é obrigatório para o Google Sign-In e as APIs criptográficas do WhatsApp Web (Web Crypto API).

---

## 4. Instalação e Configuração via SSH no Servidor

1. Conecte-se via SSH ao seu servidor DreamHost:
   ```bash
   ssh seu_usuario@direct.icone-rio.com.br
   ```

2. Navegue até a pasta de hospedagem do subdomínio:
   ```bash
   cd ~/direct.icone-rio.com.br
   ```

3. Clone o repositório oficial do GitHub:
   ```bash
   git clone https://github.com/BuggyToledo/direct_houses.git .
   ```

4. Instale as dependências do projeto:
   ```bash
   npm install
   ```

5. Faça o build de produção da aplicação:
   ```bash
   npm run build
   ```

---

## 5. Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` na raiz do projeto (`~/direct.icone-rio.com.br/.env`):

```bash
nano .env
```

Cole a configuração abaixo preenchendo suas chaves:

```env
# Porta do servidor Node.js
PORT=3000

# Chave do Google Gemini AI
GEMINI_API_KEY=sua_chave_gemini_aqui

# ID do Cliente Google OAuth (obtido no Passo 2)
GOOGLE_CLIENT_ID=seu_client_id_google.apps.googleusercontent.com

# Nome da Imobiliária
COMPANY_NAME=Direct Houses

# Ambiente de execução
NODE_ENV=production
```

Salve e feche o arquivo (`Ctrl + O`, `Enter`, `Ctrl + X`).

---

## 6. Execução em Segundo Plano com PM2 (Recomendado)

O **PM2** garante que o assistente permaneça rodando 24 horas por dia, reiniciando automaticamente em caso de falha ou reinicialização do servidor.

1. Instale o PM2 globalmente (ou localmente):
   ```bash
   npm install -g pm2
   ```

2. Inicie o servidor Node.js:
   ```bash
   pm2 start dist/server.cjs --name "direct-houses"
   ```

3. Configure o PM2 para iniciar com o boot do sistema:
   ```bash
   pm2 save
   pm2 startup
   ```

4. Comandos úteis do PM2:
   ```bash
   pm2 status          # Ver status do assistente
   pm2 logs direct-houses # Ver logs em tempo real
   pm2 restart direct-houses # Reiniciar o assistente
   ```

---

## 7. Configuração do Proxy Reverso com WebSockets

Se você estiver em um VPS DreamHost com Nginx ou Apache, certifique-se de repassar as requisições da porta 80/443 para a porta `3000` com suporte a WebSockets (necessário para a conexão contínua do WhatsApp):

### Exemplo Nginx (`/etc/nginx/conf.d/direct.icone-rio.com.br.conf`):
```nginx
server {
    server_name direct.icone-rio.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. Primeiro Acesso e Gerenciamento de Usuários

1. Abra seu navegador em: **`https://direct.icone-rio.com.br`**.
2. Clique no botão **"Entrar com Google"** e selecione a conta **`toledo@icone-rio.com.br`**.
   - O e-mail `toledo@icone-rio.com.br` está configurado como **Administrador Global Permanente** do sistema e terá acesso total imediato.
3. Para cadastrar outros corretores, secretárias ou gestores:
   - Clique no botão **"Acessos"** (ícone de chave/escudo no topo direito).
   - Digite o e-mail Google da pessoa e selecione a função (**Usuário** ou **Administrador**).
   - Clique em **"Autorizar Acesso"**.
   - Pronto! O usuário agora poderá fazer login usando sua própria Conta Google.

4. **Conectar o WhatsApp da Imobiliária**:
   - Clique no botão **"Conectar WhatsApp"** no topo.
   - Abra o WhatsApp no celular comercial da imobiliária > **Aparelhos Conectados** > **Conectar Aparelho**.
   - Aponte a câmera para o QR Code gerado na tela.
   - Após a conexão, a IA responderá os clientes 24/7 e distribuirá os leads na Roleta!

---

## 9. Backup e Manutenção

Os dados do sistema são salvos nas seguintes pastas locais:
- `.whatsapp_auth/` - Sessão criptografada do WhatsApp Web (evita ter que ler o QR Code novamente após reiniciar).
- `.data/` - Lista de usuários autorizados (`authorized-users.json`) e cadastro da roleta de corretores (`brokers.json`).

### Para atualizar o sistema no futuro com novos commits:
```bash
cd ~/direct.icone-rio.com.br
git pull origin main
npm install
npm run build
pm2 restart direct-houses
```
