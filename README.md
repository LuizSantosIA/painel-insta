# Painel Instagram

Plataforma para gestão e análise dos seus posts do Instagram: todos os posts num só lugar, métricas por tipo de conteúdo, ranking de desempenho, evolução no tempo e recomendações automáticas para trabalhar o algoritmo.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Prisma 7** + **SQLite** (via driver adapter libSQL)
- **Recharts** para gráficos
- Integração com a **Meta Graph API** (Instagram) — pluggable via `.env`

## Como rodar

```bash
npm install
npm run db:push     # cria o banco SQLite
npm run db:seed     # popula com 64 posts de exemplo
npm run dev         # http://localhost:3000
```

## Páginas

- **/** — Visão geral: KPIs, engajamento/alcance no tempo, crescimento de seguidores, desempenho por tipo, top 5 posts.
- **/posts** — Todos os posts: tabela ordenável por qualquer métrica, filtro por tipo, busca e edição do tema de cada post.
- **/recomendacoes** — Sugestões do algoritmo: melhor formato, melhor tema, melhor dia/horário, ranking de temas.
- **/integracao** — Status e passo a passo para conectar sua conta via Meta Graph API.

## Conectar o Instagram (dados reais)

Requer conta **Business ou Creator** vinculada a uma Página do Facebook e um app no
[Meta for Developers](https://developers.facebook.com). Veja o passo a passo na página **Integração**.

Depois preencha o `.env`:

```env
IG_ACCESS_TOKEN="seu_token"
IG_USER_ID="seu_ig_user_id"
```

Reinicie o servidor e clique em **Sincronizar agora** (ou chame `POST /api/sync`).

## Estrutura

```
prisma/
  schema.prisma        # modelos Post e AccountSnapshot
  seed.ts              # dados de exemplo
src/
  app/                 # páginas e API routes
  components/          # sidebar, gráficos, tabela, cards
  lib/
    prisma.ts          # client do Prisma (adapter libSQL)
    metrics.ts         # cálculos e agregações (funções puras)
    recommendations.ts # motor de recomendações
    instagram.ts       # integração Graph API
    data.ts            # queries do servidor
    constants.ts       # tipos de mídia, categorias, cores
```

## Próximos passos sugeridos

- Importação de histórico via CSV (para quem não quer usar a API logo de cara).
- Job agendado (cron) para sincronizar automaticamente todo dia.
- Migração de SQLite para Postgres (Neon) ao publicar na Vercel.
- Recomendações com IA (texto/legenda) usando o AI SDK.