import { messagingApi, validateSignature } from "@line/bot-sdk";

import { getLineChannelAccessToken, getLineChannelSecret } from "@/lib/env";

export const LINE_SIGNATURE_HEADER = "x-line-signature";

export type LineMessagingClient = {
  replyText: (replyToken: string, text: string) => Promise<void>;
};

export function isValidLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret = getLineChannelSecret(),
): boolean {
  if (!signature) {
    return false;
  }

  return validateSignature(rawBody, channelSecret, signature);
}

export function createLineMessagingClient(
  channelAccessToken = getLineChannelAccessToken(),
): LineMessagingClient {
  const client = new messagingApi.MessagingApiClient({ channelAccessToken });

  return {
    async replyText(replyToken: string, text: string): Promise<void> {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text,
          },
        ],
      });
    },
  };
}