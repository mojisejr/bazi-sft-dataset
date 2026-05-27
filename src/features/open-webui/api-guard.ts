import { getOpenWebUiApiToken } from "@/lib/env";

export function validateApiToken(
  req: Request,
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): Response | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const expectedToken = getOpenWebUiApiToken(raw);

  if (token !== expectedToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}