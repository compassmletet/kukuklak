export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // --- OPTIMALISASI HEMAT KV (HANYA UNTUK FILE STATIS & BUKAN ADMIN) ---
  const bypass = [".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".txt"];
  const isStatic = bypass.some(ext => url.pathname.toLowerCase().endsWith(ext));
  
  if (isStatic && request.method !== "POST" && !url.pathname.includes("/admin")) {
    return next();
  }

  // 1. DETEKSI HOSTNAME ASLI (Support Router Subdomain)
  // Prioritas: X-Forwarded-Host -> Host -> url.hostname
  let hostname = request.headers.get("X-Forwarded-Host") || request.headers.get("Host") || url.hostname;

  // Bersihkan port jika ada (misal: domain.com:443 -> domain.com)
  if (hostname.includes(":")) {
    hostname = hostname.split(":")[0];
  }

  // 2. AMBIL DATA DARI KV
  let pinterestCode = "";
  let histatsId = "";

  try {
    if (env.MY_KV) {
      // Ambil data JSON spesifik untuk domain ini dengan tambahan cacheTtl
      const data = await env.MY_KV.get(hostname, { type: "json", cacheTtl: 3600 });
      if (data) {
        pinterestCode = data.p_code || "";
        histatsId = data.h_id || "";
      }
    }
  } catch (e) {
    // Silent error: Jika KV gagal, website tetap jalan normal tanpa injeksi
  }

  // --- FITUR A: VERIFIKASI FILE ---
  // Jika bot akses /kodeunik.html, kita layani langsung
  if (pinterestCode && url.pathname === `/${pinterestCode}.html`) {
    return new Response(pinterestCode, { headers: { "Content-Type": "text/html" } });
  }

  // 3. LANJUTKAN REQUEST ASLI
  const response = await next();

  // Cek apakah kontennya HTML (jaga-jaga biar gak rusak gambar/css)
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("text/html")) {
    return response; 
  }

  // Jika tidak ada data injeksi, kembalikan response apa adanya (hemat resource)
  if (!pinterestCode && !histatsId) {
    return response;
  }

  // --- FITUR B: SIAPKAN INJEKSI ---
  
  // Meta Tag Pinterest
  let headContent = "";
  if (pinterestCode) {
    headContent = `<meta name="p:domain_verify" content="${pinterestCode}" />\n`;
  }

  // Script Histats
  let bodyContent = "";
  if (histatsId) {
    bodyContent = `
    <script type="text/javascript">var _Hasync= _Hasync|| [];
    _Hasync.push(['Histats.start', '1,${histatsId},4,0,0,0,00010000']);
    _Hasync.push(['Histats.fasi', '1']);
    _Hasync.push(['Histats.track_hits', '']);
    (function() {
    var hs = document.createElement('script'); hs.type = 'text/javascript'; hs.async = true;
    hs.src = ('//s10.histats.com/js15_as.js');
    (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(hs);
    })();</script>
    <noscript><a href="/" target="_blank"><img src="//sstatic1.histats.com/0.gif?${histatsId}&101" alt="web stats" border="0"></a></noscript>
    `;
  }

  // --- 4. EKSEKUSI PENYUNTIKAN (HTMLRewriter) ---
  const newResponse = new HTMLRewriter()
    .on('head', {
      element(element) {
        if (headContent) element.prepend(headContent, { html: true });
      }
    })
    .on('body', {
      element(element) {
        if (bodyContent) element.append(bodyContent, { html: true });
      }
    })
    .transform(response);

  // Anti-Cache (Penting agar bot selalu dapat versi terbaru)
  newResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  
  return newResponse;
}
