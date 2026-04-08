# Painel MS TV — Deploy pronto no Render

## O que já está pronto
- Backend Node.js + Express
- Frontend servido pelo próprio backend
- Integração com `POST /listas/minhas`
- Dashboard calculado
- Financeiro automático
- Geração de link de cobrança por WhatsApp
- Arquivo `render.yaml` pronto para deploy

## Antes de publicar
Troque o token antigo por um novo e use apenas o novo no Render.

## Subir no GitHub
1. Crie um repositório no GitHub chamado `painel-ms-tv`
2. Envie o conteúdo desta pasta inteira

## Deploy no Render
1. Acesse o Render
2. Clique em **New +** > **Blueprint**
3. Conecte o repositório do GitHub
4. Selecione o repositório
5. O Render vai ler o arquivo `render.yaml`
6. Adicione a variável `PDC_TOKEN` com seu token novo
7. Faça o deploy

## Variáveis de ambiente
- `PDC_API_URL=https://pdcapi.io`
- `PDC_ORIGIN=https://dashboard.bz`
- `PDC_TOKEN=SEU_TOKEN_NOVO`

## Testes após deploy
- `/health`
- `/api/clients`
- `/api/finance/summary`
- `/api/whatsapp/link?phone=62991133110&name=Joao&dueDate=05/04/2026`

## Rodar local
### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Abra no navegador:
- `http://localhost:5000/`
- `http://localhost:5000/api/clients`
