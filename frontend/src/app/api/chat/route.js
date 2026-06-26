import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_CHATBOT_ID =
  process.env.NEXT_PUBLIC_DEMO_CHATBOT_ID || process.env.DEMO_CHATBOT_ID || "";

export async function POST(request) {
  try {
    const body = await request.json();
    const message = (body?.message || "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    if (!DEMO_CHATBOT_ID) {
      return NextResponse.json(
        { error: "Demo chatbot is not configured. Set NEXT_PUBLIC_DEMO_CHATBOT_ID." },
        { status: 500 }
      );
    }

    const isStream = body?.stream === true;
    const endpoint = isStream ? "/api/chat/stream" : "/api/chat/";

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatbot_id: DEMO_CHATBOT_ID,
        session_id: body?.session_id || null,
        visitor_id: body?.visitor_id || "landing-page-demo",
        message,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.detail || "Demo chatbot request failed." },
        { status: response.status }
      );
    }

    // If it's a stream, pipe it through
    if (isStream) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await response.json();
    return NextResponse.json({
      session_id: data?.session_id || null,
      response: data?.agent_response?.response || "",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error while processing demo chat." },
      { status: 500 }
    );
  }
}
