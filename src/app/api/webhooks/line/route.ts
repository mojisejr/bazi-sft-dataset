import { after } from "next/server";

import { createLineAuthGuard } from "@/features/line-chat/auth-guard";
import { createLineMessagingClient, isValidLineSignature } from "@/features/line-chat/line-client";
import { createLineWebhookHandler } from "@/features/line-chat/webhook";
import { getLineChannelSecret, getLineLoginUrl } from "@/lib/env";

export async function POST(request: Request) {
  const handler = createLineWebhookHandler({
    validateSignature: (rawBody, signature) =>
      isValidLineSignature(rawBody, signature, getLineChannelSecret()),
    authGuard: createLineAuthGuard(),
    messagingClient: createLineMessagingClient(),
    scheduleAfter: after,
    loginUrl: getLineLoginUrl(),
  });

  return handler(request);
}