import { Suspense } from "react";
import { isConfigured } from "@/lib/instagram";
import { getPostCount } from "@/lib/data";
import { SyncButton } from "@/components/sync-button";
import { TokenForm } from "@/components/token-form";
import { CheckCircle2, XCircle, Plug, KeyRound, MessageCircle } from "lucide-react";
import { FacebookPageForm } from "@/components/facebook-page-form";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Conta Business ou Creator",
    detail:
      "No app do Instagram: Configurações → Conta → mude para conta profissional e vincule a uma Página do Facebook.",
  },
  {
    title: "Crie um app no Meta for Developers",
    detail:
      "Em developers.facebook.com, crie um app e adicione o produto 'Instagram Graph API'.",
  },
  {
    title: "Gere um token de acesso de longa duração",
    detail:
      "Permissões necessárias: instagram_basic, instagram_manage_insights, pages_read_engagement.",
  },
  {
    title: "Descubra seu IG User ID",
    detail:
      "É o id da sua conta business (obtido via /me/accounts → instagram_business_account).",
  },
  {
    title: "Preencha o arquivo .env",
    detail: "IG_ACCESS_TOKEN e IG_USER_ID. Depois reinicie o servidor e clique em Sincronizar.",
  },
];

export default async function IntegrationPage() {
  const configured = isConfigured();
  const count = await getPostCount();
  const fbPageId = process.env.FB_PAGE_ID ?? "";
  const fbPageToken = process.env.FB_PAGE_ACCESS_TOKEN ?? "";
  const fbConnected = Boolean(fbPageId && fbPageToken);

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Integração</h1>
        <p className="text-sm text-muted">
          Conecte sua conta do Instagram para importar posts e métricas automaticamente.
        </p>
      </header>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2">
              <Plug className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="font-medium">Meta Graph API (Instagram)</p>
              <div className="mt-1 flex items-center gap-2 text-sm">
                {configured ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Configurada
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <XCircle className="h-4 w-4" /> Não configurada
                  </span>
                )}
                <span className="text-muted">· {count} posts no banco</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <Suspense>
            <SyncButton configured={configured} />
          </Suspense>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2">
              <MessageCircle className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="font-medium">Facebook Page (Direct Messages)</p>
              <div className="mt-1 flex items-center gap-2 text-sm">
                {fbConnected ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Conectada — DM para qualquer comentarista
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <XCircle className="h-4 w-4" /> Não conectada — DM limitado a seguidores
                  </span>
                )}
              </div>
                </div>
          </div>
        </div>
        {!fbConnected && (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 space-y-2 text-sm text-muted">
              <p className="font-medium text-foreground">Como obter o Page Access Token:</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>
                  Abra o{" "}
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-brand"
                  >
                    Graph API Explorer
                  </a>
                </li>
                <li>
                  No dropdown <strong className="text-foreground">"App da Meta"</strong> (canto superior direito), mude para{" "}
                  <strong className="text-foreground">"Explorador da Graph API"</strong>
                </li>
                <li>
                  No dropdown ao lado, onde está escrito <strong className="text-foreground">"Usuário ou Página"</strong>,{" "}
                  clique e selecione sua Página <strong className="text-foreground">"Luiz Santos IA"</strong>
                </li>
                <li>
                  Clique em <strong className="text-foreground">"Gerar token de acesso"</strong> — marque as permissões{" "}
                  <strong className="text-foreground">pages_messaging</strong> e{" "}
                  <strong className="text-foreground">pages_read_engagement</strong> quando pedido
                </li>
                <li>Copie o token gerado (texto longo) e cole abaixo</li>
              </ol>
            </div>
            <FacebookPageForm />
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand" />
          <h2 className="font-medium">Renovar token (60 dias)</h2>
        </div>
        <p className="mb-3 text-sm text-muted">
          No portal do Meta, vá em <strong>Instagram → Gerar token de acesso</strong>, copie o token gerado e cole abaixo. O sistema troca automaticamente por um token de 60 dias.
        </p>
        <TokenForm />
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-medium">Como conectar (passo a passo)</h2>
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-muted">
          <p># .env</p>
          <p>IG_ACCESS_TOKEN=seu_token_aqui</p>
          <p>IG_USER_ID=seu_ig_user_id</p>
        </div>
      </div>
    </div>
  );
}