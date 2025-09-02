export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing DAILY_API_KEY" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Optional custom name for the room
  let requestedName: string | undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      requestedName = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined;
    }
  } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: requestedName,
        privacy: "public",
        properties: {
          enable_screenshare: true,
          enable_chat: true,
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let detail: unknown = undefined;
      try {
        detail = await response.json();
      } catch {
        detail = await response.text();
      }
      return new Response(
        JSON.stringify({
          error: "daily-api-error",
          status: response.status,
          statusText: response.statusText,
          detail,
        }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    const data = (await response.json()) as { url?: string; name?: string } & Record<string, unknown>;

    // Ensure we have a usable URL. Some responses may omit it; construct from domain + name.
    let roomUrl = data.url as string | undefined;
    if (!roomUrl && data.name) {
      const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN;
      if (domain) {
        const base = domain.includes("http") ? domain : `https://${domain}`;
        roomUrl = `${base}/${data.name}`;
      }
    }

    return new Response(JSON.stringify({ room: { ...data, url: roomUrl } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return new Response(
      JSON.stringify({
        error: isAbort ? "daily-request-timeout" : "daily-request-failed",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}


