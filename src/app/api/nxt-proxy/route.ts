import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { endpoint, method = "GET", headers = {}, body, isFormData = false } = await req.json();

    const targetUrl = `https://lcoportalnew6.nxtdigital.in${endpoint}`;

    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://lcoportalnew6.nxtdigital.in/",
      "Origin": "https://lcoportalnew6.nxtdigital.in",
      ...headers
    };

    let fetchBody: any = undefined;
    if (body) {
      if (isFormData) {
        const formData = new FormData();
        for (const [key, val] of Object.entries(body)) {
          formData.append(key, String(val));
        }
        fetchBody = formData;
      } else {
        fetchBody = JSON.stringify(body);
      }
    }

    const res = await fetch(targetUrl, {
      method,
      headers: fetchHeaders,
      body: fetchBody
    });

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
    const text = await res.text();

    return NextResponse.json({
      status: res.status,
      cookies: setCookies,
      body: text
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
