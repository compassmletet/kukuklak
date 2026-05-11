// Hardcode: /functions/image-proxy.js

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 1. Handle CORS Pre-flight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // 2. Ambil URL target
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing 'url' parameter", { status: 400 });
  }

  try {
    // 3. Siapkan Request ke Sumber Asli
    // --- PERUBAHAN UTAMA DI SINI ---
    // Kita PAKSA pakai "GET" walaupun bot mintanya "HEAD".
    // Ini supaya server gambar asli (Picsum dll) tidak menolak dengan error 405.
    const proxyRequest = new Request(imageUrl, {
      method: "GET", 
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "image/*"
      }
    });

    // 4. Fetch Gambar
    const imageResponse = await fetch(proxyRequest);

    // 5. Siapkan Header Respon
    const newHeaders = new Headers(imageResponse.headers);
    
    // Header Wajib untuk Bot Podcast
    newHeaders.set("Access-Control-Allow-Origin", "*");
    
    // Pastikan Content-Type terisi
    if (!newHeaders.has("Content-Type")) {
      newHeaders.set("Content-Type", "image/jpeg");
    }

    // Cache
    newHeaders.set("Cache-Control", "public, max-age=86400, s-maxage=86400");

    // 6. Return Response
    // Kita kembalikan body full. Jika bot cuma minta HEAD, 
    // sistem Cloudflare otomatis hanya akan mengirim headernya saja.
    return new Response(imageResponse.body, {
      status: imageResponse.status,
      headers: newHeaders
    });

  } catch (e) {
    return new Response(`Proxy Error: ${e.message}`, { status: 500 });
  }
}
