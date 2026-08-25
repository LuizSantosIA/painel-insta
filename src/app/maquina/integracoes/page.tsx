import { Suspense } from "react";
import { isConfigured } from "@/lib/instagram";
import { SyncButton } from "@/components/sync-button";
import { TokenForm } from "@/components/token-form";
import { FacebookPageForm } from "@/components/facebook-page-form";
import { StatusIntegracoes } from "@/components/maquina/status-integracoes";
import { Section, SectionHeader } from "@/components/negocio/panel";
import { KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Integrações — área de configuração da Máquina.
 *
 * A tela abre pelo estado real de cada conexão (conectada, última sincronização,
 * o que está quebrado) e só depois pelos formulários de token, que são exatamente
 * os mesmos de antes. Nenhuma integração inventada: aqui só aparece o que o
 * projeto realmente usa.
 */

const PASSOS = [
  {
    titulo: "Conta Business ou Creator",
    detalhe:
      "No app do Instagram: Configurações → Conta → mude para conta profissional e vincule a uma Página do Facebook.",
  },
  {
    titulo: "Crie um app no Meta for Developers",
    detalhe:
      "Em developers.facebook.com, crie um app e adicione o produto 'Instagram Graph API'.",
  },
  {
    titulo: "Gere um token de acesso de longa duração",
    detalhe:
      "Permissões necessárias: instagram_basic, instagram_manage_insights, pages_read_engagement.",
  },
  {
    titulo: "Descubra seu IG User ID",
    detalhe: "É o id da sua conta business (obtido via /me/accounts → instagram_business_account).",
  },
  {
    titulo: "Preencha o arquivo .env",
    detalhe:
      "IG_ACCESS_TOKEN e IG_USER_ID. Depois reinicie o servidor e clique em Sincronizar.",
  },
];

export default async function IntegracoesPage() {
  const configurado = isConfigured();
  const fbConectada = Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN);

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Integrações</h1>
        <p className="mt-0.5 text-[12px] text-muted">
          As conexões que alimentam a Máquina — estado, última sincronização e problemas
        </p>
      </header>

      <StatusIntegracoes />

      <Section>
        <SectionHeader titulo="Sincronizar agora" meta="conteúdos, métricas e seguidores" />
        <div className="pt-3">
          <Suspense>
            <SyncButton configured={configurado} />
          </Suspense>
        </div>
      </Section>

      <Section>
        <SectionHeader titulo="Renovar token do Instagram" meta="validade de 60 dias" />
        <div className="space-y-3 pt-3">
          <p className="flex items-start gap-2 text-[12px] text-muted">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            No portal do Meta, vá em <strong className="text-foreground-2">Instagram → Gerar
            token de acesso</strong>, copie o token e cole abaixo. O sistema troca automaticamente
            por um token de 60 dias.
          </p>
          <TokenForm />
        </div>
      </Section>

      {!fbConectada && (
        <Section>
          <SectionHeader titulo="Conectar a Página do Facebook" meta="amplia o envio de DM" />
          <div className="space-y-4 pt-3">
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-[12px] text-muted">
              <p className="mb-2 font-medium text-foreground">Como obter o Page Access Token:</p>
              <ol className="list-inside list-decimal space-y-1.5">
                <li>
                  Abra o{" "}
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline"
                  >
                    Graph API Explorer
                  </a>
                </li>
                <li>
                  No dropdown <strong className="text-foreground-2">App da Meta</strong>, mude para{" "}
                  <strong className="text-foreground-2">Explorador da Graph API</strong>
                </li>
                <li>
                  Em <strong className="text-foreground-2">Usuário ou Página</strong>, selecione sua
                  Página
                </li>
                <li>
                  Clique em <strong className="text-foreground-2">Gerar token de acesso</strong> e
                  marque <strong className="text-foreground-2">pages_messaging</strong> e{" "}
                  <strong className="text-foreground-2">pages_read_engagement</strong>
                </li>
                <li>Copie o token gerado e cole abaixo</li>
              </ol>
            </div>
            <FacebookPageForm />
          </div>
        </Section>
      )}

      <Section>
        <SectionHeader titulo="Como conectar do zero" meta="passo a passo" />
        <ol className="divide-y divide-border-subtle/70">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-3 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-foreground">{p.titulo}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">{p.detalhe}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-lg border border-border bg-surface-2/50 p-3.5 font-mono text-[11px] text-muted">
          <p># .env</p>
          <p>IG_ACCESS_TOKEN=seu_token_aqui</p>
          <p>IG_USER_ID=seu_ig_user_id</p>
        </div>
      </Section>
    </div>
  );
}
