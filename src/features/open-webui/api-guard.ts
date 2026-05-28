import { getOpenWebUiApiToken } from "@/lib/env";

export function validateApiToken(
  req: Request,
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): Response | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    console.warn("[open-webui] missing authorization header");
    return new Response("Unauthorized", { status: 401 });
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    console.warn("[open-webui] invalid authorization scheme");
    return new Response("Unauthorized", { status: 401 });
  }

  const expectedToken = getOpenWebUiApiToken(raw);

  if (token !== expectedToken) {
    console.warn("[open-webui] api token mismatch");
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}