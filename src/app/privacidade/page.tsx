export const metadata = { title: "Política de Privacidade" };

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="mb-6 text-2xl font-semibold">Política de Privacidade</h1>

      <p className="mb-4">
        Este aplicativo é uma ferramenta de gestão de conta do Instagram para uso
        exclusivo do próprio titular da conta. Não prestamos serviços a terceiros
        nem coletamos dados de usuários finais.
      </p>

      <h2 className="mb-2 mt-6 font-semibold">Dados acessados</h2>
      <p className="mb-4">
        O aplicativo acessa, via Instagram Graph API, os dados da conta Instagram
        autorizada: publicações, comentários e mensagens diretas. Esses dados são
        usados exclusivamente para automatizar respostas configuradas pelo próprio
        titular da conta.
      </p>

      <h2 className="mb-2 mt-6 font-semibold">Armazenamento</h2>
      <p className="mb-4">
        Os dados são armazenados localmente no dispositivo do titular da conta e não
        são compartilhados com terceiros.
      </p>

      <h2 className="mb-2 mt-6 font-semibold">Retenção</h2>
      <p className="mb-4">
        Os dados são retidos enquanto o titular mantiver o aplicativo instalado e
        podem ser excluídos a qualquer momento pelo próprio usuário.
      </p>

      <h2 className="mb-2 mt-6 font-semibold">Contato</h2>
      <p>
        Dúvidas:{" "}
        <a
          href="mailto:luizsantos.automation@gmail.com"
          className="underline"
        >
          luizsantos.automation@gmail.com
        </a>
      </p>
    </main>
  );
}
