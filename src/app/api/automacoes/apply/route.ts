import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchComments, replyToComment, sendDirectMessage, isConfigured } from "@/lib/instagram";

function matchesRule(text: string, keywords: string): boolean {
  const kws = keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  const lower = text.toLowerCase();
  return kws.some((kw) => lower.includes(kw));
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Integração não configurada" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const mediaId: string = body.mediaId ?? "";
  const dryRun: boolean = body.dryRun ?? false;

  if (!mediaId) {
    return NextResponse.json({ error: "mediaId é obrigatório" }, { status: 400 });
  }

  const [comments, rules] = await Promise.all([
    fetchComments(mediaId),
    prisma.autoRule.findMany({ where: { isActive: true } }),
  ]);

  if (comments.length === 0) {
    return NextResponse.json({ matched: 0, replied: 0, dmSent: 0, skipped: 0, preview: [] });
  }

  const existingLogs = await prisma.commentLog.findMany({
    where: { igCommentId: { in: comments.map((c) => c.id) } },
    select: { igCommentId: true },
  });
  const alreadyProcessed = new Set(existingLogs.map((l) => l.igCommentId));

  const preview: {
    commentId: string;
    username: string;
    text: string;
    ruleName: string;
    ruleId: string;
    willReply: boolean;
    willDm: boolean;
    hasSenderId: boolean;
  }[] = [];

  let replied = 0;
  let dmSent = 0;
  let skipped = 0;

  for (const comment of comments) {
    if (alreadyProcessed.has(comment.id)) { skipped++; continue; }

    const rule = rules.find(
      (r) => (!r.mediaId || r.mediaId === mediaId) && matchesRule(comment.text, r.keywords)
    );
    if (!rule) continue;

    const senderId = comment.from?.id ?? "";
    const willReply = rule.replyText.trim().length > 0;
    const willDm = rule.sendDm && rule.dmText.trim().length > 0 && !!senderId;

    preview.push({
      commentId: comment.id,
      username: comment.username ?? "",
      text: comment.text,
      ruleName: rule.name || rule.keywords,
      ruleId: rule.id,
      willReply,
      willDm,
      hasSenderId: !!senderId,
    });

    if (!dryRun) {
      let commentReplied = false;
      let dmSentOk = false;

      if (willReply) {
        try { await replyToComment(comment.id, rule.replyText); commentReplied = true; replied++; }
        catch { skipped++; }
      }

      if (rule.sendDm && rule.dmText.trim() && senderId) {
        try { await sendDirectMessage(senderId, rule.dmText); dmSentOk = true; dmSent++; }
        catch { /* DM failure não bloqueia o log */ }
      }

      if (commentReplied || dmSentOk) {
        await prisma.commentLog.create({
          data: {
            igCommentId: comment.id,
            igPostId: mediaId,
            text: comment.text,
            username: comment.username ?? "",
            senderId,
            repliedAt: commentReplied ? new Date() : null,
            dmSentAt: dmSentOk ? new Date() : null,
            ruleId: rule.id,
          },
        });
        await prisma.autoRule.update({
          where: { id: rule.id },
          data: { triggerCount: { increment: 1 } },
        });
      }
    }
  }

  return NextResponse.json({
    total: comments.length,
    matched: preview.length,
    replied: dryRun ? 0 : replied,
    dmSent: dryRun ? 0 : dmSent,
    skipped,
    preview,
  });
}
