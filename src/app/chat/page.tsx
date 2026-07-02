import { ChatWindow } from "@/components/chat-window";
import { Bot } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col space-y-4">
      <header className="flex items-center gap-3">
        <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistente IA</h1>
          <p className="text-sm text-muted">
            Conheço todos os dados do seu perfil — pergunte o que quiser.
          </p>
        </div>
      </header>
      <ChatWindow />
    </div>
  );
}