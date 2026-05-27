import type { RegisteredLineUser } from "./auth-guard";
import type { LineMessagingClient } from "./line-client";

type LineEventSource = {
  type: string;
  userId?: string;
};

type LineTextMessageEvent = {
  type: "message";
  replyToken: string;
  source: LineEventSource;
  message: {
    type: "text";
    text: string;
  };
};

type LineWebhookPayload = {
  events?: unknown;
};

export type LineWebhookAuthGuard = {
  getRegisteredUser: (lineUserId: string) => Promise<RegisteredLineUser | null>;
};

export type ScheduleAfter = (callback: () => Promise<void> | void) => void;

export type CreateLineWebhookHandlerOptions = {
  validateSignature: (rawBody: string, signature: string | null) => boolean;
  authGuard: LineWebhookAuthGuard;
  messagingClient: LineMessagingClient;
  scheduleAfter: ScheduleAfter;
  loginUrl: string;
};

function isLineTextMessageEvent(value: unknown): value is LineTextMessageEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LineTextMessageEvent>;

  return (
    candidate.type === "message" &&
    typeof candidate.replyToken === "string" &&
    typeof candidate.source?.userId === "string" &&
    candidate.message?.type === "text" &&
    typeof candidate.message.text === "string"
  );
}

function getLineEvents(payload: unknown): LineTextMessageEvent[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const { events } = payload as LineWebhookPayload;

  if (!Array.isArray(events)) {
    return [];
  }

  return events.filter(isLineTextMessageEvent);
}

export function buildLineLoginPrompt(loginUrl: string): string {
  return `กรุณาเข้าสู่ระบบก่อนนะคะ เพื่อให้พี่นุ้ยดูแลดวงชะตาต่อได้ที่ ${loginUrl}`;
}

export function buildTemporaryEchoReply(message: string): string {
  return `รับข้อความแล้วนะคะ: ${message}`;
}

export function createLineWebhookHandler({
  validateSignature,
  authGuard,
  messagingClient,
  scheduleAfter,
  loginUrl,
}: CreateLineWebhookHandlerOptions) {
  return async function handleLineWebhook(request: Request): Promise<Response> {
    const signature = request.headers.get("x-line-signature");
    const rawBody = await request.text();

    if (!validateSignature(rawBody, signature)) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const events = getLineEvents(payload);

    for (const event of events) {
      const lineUserId = event.source.userId;

      if (!lineUserId) {
        continue;
      }

      const mapping = await authGuard.getRegisteredUser(lineUserId);

      if (!mapping) {
        await messagingClient.replyText(event.replyToken, buildLineLoginPrompt(loginUrl));
        continue;
      }

      scheduleAfter(async () => {
        await messagingClient.replyText(
          event.replyToken,
          buildTemporaryEchoReply(event.message.text),
        );
      });
    }

    return new Response("OK", { status: 200 });
  };
}