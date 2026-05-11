// Hardcode: /functions/podcast-audio/[id].mp3.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Pastikan nama file ini SAMA PERSIS dengan yang di folder public/audio
  const TARGET_FILE = "/audio/amz.mp3";

  try {
    const assetUrl = new URL(url);
    assetUrl.pathname = TARGET_FILE;

    // 1. Minta file MENTAH ke Internal System
    const assetRequest = new Request(assetUrl, {
      method: "GET",
      headers: {
        "Accept-Encoding": "identity", // Tolak Gzip dari Internal
        "User-Agent": "No-Compression-Bot"
      }
    });

    const response = await env.ASSETS.fetch(assetRequest);

    if (!response.ok) {
      return new Response(`FILE NOT FOUND (404). Cek nama file: ${TARGET_FILE}`, { status: 404 });
    }

    // 2. Siapkan Header Anti-Kompresi
    const newHeaders = new Headers(response.headers);

    // HAPUS header yang bikin validator bingung
    newHeaders.delete("Content-Encoding");
    newHeaders.delete("Transfer-Encoding");
    newHeaders.delete("Vary"); // Hapus vary agar tidak cache versi gzip

    // 🛑 KUNCI: Header Sakti "no-transform"
    // Ini memerintahkan Cloudflare CDN (Global) untuk JANGAN PERNAH mengompres file ini
    newHeaders.set("Cache-Control", "public, max-age=3600, no-transform");

    // Header Metadata
    if (response.headers.has("Content-Length")) {
      newHeaders.set("Content-Length", response.headers.get("Content-Length"));
    }
    
    // Header Wajib Podcast
    newHeaders.set("Content-Type", "audio/mpeg");
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Accept-Ranges", "bytes"); // Validator butuh ini untuk cek header ID3

    // 3. Return File
    return new Response(response.body, {
      status: 200,
      headers: newHeaders
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
