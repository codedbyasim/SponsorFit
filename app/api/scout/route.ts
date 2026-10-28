import { runScout, type Emit } from "@/lib/agent";
import { qlooConfigured } from "@/lib/qloo/client";
import { allowRequest } from "@/lib/rate-limit";
import type { ScoutInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (UUID_RE.test(trimmed) || /^demo-entity-[a-z0-9-]{3,48}$/.test(trimmed)) return trimmed;
  return undefined;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

export async function POST(request: Request) {
  if (!allowRequest(clientIp(request))) {
    return Response.json(
      { error: "Too many scouts from this network. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let payload: Partial<ScoutInput> = {};
  try {
    payload = (await request.json()) as Partial<ScoutInput>;
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: Emit = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runScout(
          {
            query: String(payload.query ?? ""),
            entityId: cleanId(payload.entityId),
            compareQuery: payload.compareQuery ? String(payload.compareQuery) : undefined,
            compareEntityId: cleanId(payload.compareEntityId),
            city: payload.city ? String(payload.city) : undefined,
          },
          send,
          { paceMs: qlooConfigured() ? 0 : 110 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scout failed.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
