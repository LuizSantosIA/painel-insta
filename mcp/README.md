# Command Center via MCP

Faz o Command Center falar com um agente: **OpenJarvis**, Claude Desktop, Claude Code — qualquer cliente MCP.

```
você fala → agente → mcp/command-center.mjs (na sua máquina, stdio)
                            ↓ HTTPS com token
                     Vercel: /api/mcp
                            ↓
                     Turso · Instagram · máquina de conteúdo
```

O token fica no seu computador. A única porta pública é `/api/mcp`, e ela só responde a quem tem o token — sem `MCP_API_TOKEN` configurado, responde 503 e nada mais.

## Ferramentas (fase 1 — só leitura)

| Ferramenta | Para que serve |
|---|---|
| `hoje` | o que precisa de decisão hoje, agenda, tarefas, próximos dias |
| `maquina_status` | fila de aprovação, produção, agendados, modo e chaves faltando |
| `post_detalhe` | um post inteiro: slides, legenda, CTA, fact-check, revisão |
| `clientes` | carteira com saúde (VERMELHO / AMARELO / VERDE) |
| `cliente_detalhe` | ficha 360 — aceita id **ou parte do nome** |
| `financeiro` | MRR, recebido, a receber, vencido, caixa, runway |
| `pipeline` | oportunidades por estágio e quem está parado |
| `instagram` | conversas aguardando, automações e disparos |

Nada aqui publica, cobra, envia mensagem ou altera dado. Escrita entra na fase 2, com confirmação.

**Ferramenta nova é só deploy** — o catálogo é descoberto no boot, nada muda no seu computador.

## Instalar

### 1. Gerar o token

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Pôr o token na Vercel

Projeto → Settings → Environment Variables → `MCP_API_TOKEN` = o valor gerado (Production). Depois, redeploy.

### 3. Se o projeto tiver proteção de deploy ligada

Settings → Deployment Protection → **Protection Bypass for Automation** → copie o segredo. Ele vira `VERCEL_BYPASS_TOKEN` abaixo. Sem isso, a Vercel responde a tela de login em vez da API.

### 4. Apontar o agente para cá

**OpenJarvis** — em `config.toml`:

```toml
[tools.mcp]
enabled = true
servers = "mcp-servers.json"
```

E em `mcp-servers.json` (modelo pronto em `mcp/mcp-servers.json`):

```json
[
  {
    "name": "command-center",
    "command": "node",
    "args": ["C:/Users/Parceiro/projeto insta/mcp/command-center.mjs"],
    "env": {
      "COMMAND_CENTER_URL": "https://painel-insta.vercel.app",
      "COMMAND_CENTER_TOKEN": "cole-o-token-aqui",
      "VERCEL_BYPASS_TOKEN": "cole-se-houver-protecao"
    }
  }
]
```

**Claude Desktop / Claude Code** — mesmo bloco, dentro de `mcpServers`:

```json
{
  "mcpServers": {
    "command-center": {
      "command": "node",
      "args": ["C:/Users/Parceiro/projeto insta/mcp/command-center.mjs"],
      "env": { "COMMAND_CENTER_URL": "...", "COMMAND_CENTER_TOKEN": "..." }
    }
  }
}
```

## Testar sem agente nenhum

```bash
# catálogo
curl -H "Authorization: Bearer $MCP_API_TOKEN" https://painel-insta.vercel.app/api/mcp

# uma ferramenta
curl -X POST https://painel-insta.vercel.app/api/mcp \
  -H "Authorization: Bearer $MCP_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"tool":"hoje"}'
```

## Quando algo não funciona

| Resposta | O que é |
|---|---|
| `503 MCP desligado` | falta `MCP_API_TOKEN` na Vercel, ou tem menos de 24 caracteres |
| `401 Token inválido` | o token do agente não bate com o da Vercel |
| HTML de login | proteção de deploy ligada — falta `VERCEL_BYPASS_TOKEN` |
| `Faltam COMMAND_CENTER_URL…` | o agente não passou as variáveis de ambiente |

## Perguntas que ele responde

> o que eu preciso decidir hoje? · tem algo vencido? · quais clientes estão em risco? ·
> me fala da Mantegaria · quanto entrou esse mês e quanto tenho de runway? ·
> tem post esperando aprovação? · me lê o post que está em produção ·
> quantas conversas estão sem resposta? · quem está travado no pipeline?
