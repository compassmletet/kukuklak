export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  let message = "";
  let searchResult = null;
  let searchDomain = "";

  // --- LOGIKA BACKEND ---
  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const password = formData.get("password");
      const action = formData.get("action");
      
      // 1. Validasi Password (Berlaku untuk semua aksi POST)
      if (password !== env.ADMIN_PASSWORD) {
        return new Response("Password Salah! Akses Ditolak.", { status: 403 });
      }

      const targetDomain = formData.get("domain")?.trim().toLowerCase();

      // 2. FITUR EXPORT (Dijalankan sebelum validasi domain manual)
      if (action === "export") {
        const list = await env.MY_KV.list();
        let csvContent = "domain,p_code,h_id\n";

        for (const key of list.keys) {
          const data = await env.MY_KV.get(key.name, { type: "json" });
          if (data) {
            const p = data.p_code || "";
            const h = data.h_id || "";
            csvContent += `${key.name},${p},${h}\n`;
          }
        }

        return new Response(csvContent, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename=backup_domains.csv"
          }
        });
      }

      // 3. FITUR BULK UPLOAD (Dijalankan sebelum validasi domain manual)
      else if (action === "bulk") {
        const file = formData.get("csv_file");
        if (!file || file.size === 0) throw new Error("Silakan pilih file CSV terlebih dahulu");
        
        const text = await file.text();
        const lines = text.split("\n");
        let count = 0;

        for (let line of lines) {
          if (!line.trim()) continue;
          const [d, p, h] = line.split(",").map(item => item?.trim());
          
          if (d) {
            await env.MY_KV.put(d.toLowerCase(), JSON.stringify({ 
              p_code: p || "", 
              h_id: h || "" 
            }));
            count++;
          }
        }
        message = `🚀 Berhasil upload ${count} domain dari CSV!`;
      }

      // 4. FITUR CEK DATA
      else if (action === "check") {
        if (!targetDomain) throw new Error("Masukkan Nama Domain untuk dicek");
        const data = await env.MY_KV.get(targetDomain, { type: "json" });
        searchDomain = targetDomain;
        if (data) {
          searchResult = data;
          message = `✅ Data ditemukan untuk: ${targetDomain}`;
        } else {
          message = `⚠️ Belum ada data untuk: ${targetDomain}`;
        }
      }

      // 5. FITUR SIMPAN MANUAL
      else if (action === "save") {
        if (!targetDomain) throw new Error("Nama Domain wajib diisi untuk simpan manual");
        const p_code = formData.get("p_code").trim();
        const h_id = formData.get("h_id").trim();

        await env.MY_KV.put(targetDomain, JSON.stringify({ p_code, h_id }));
        message = `💾 Sukses! Data disimpan untuk: ${targetDomain}`;
        searchDomain = targetDomain;
        searchResult = { p_code, h_id };
      }

      // 6. FITUR HAPUS
      else if (action === "delete") {
        if (!targetDomain) throw new Error("Domain tidak valid");
        await env.MY_KV.delete(targetDomain);
        message = `🗑️ Data untuk ${targetDomain} telah dihapus.`;
        searchDomain = "";
        searchResult = null;
      }

    } catch (err) {
      message = `Error: ${err.message}`;
    }
  }

  // --- LOGIKA FRONTEND (HTML) ---
  const valDomain = searchDomain || "";
  const valPCode = searchResult ? searchResult.p_code : "";
  const valHId = searchResult ? searchResult.h_id : "";

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8"> <title>Domain Manager Pro</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; background: #f0f2f5; color: #333; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; color: #1a202c; text-align: center; }
        .alert { padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 0.9em; text-align: center; background: #e6fffa; color: #2c7a7b; border: 1px solid #b2f5ea; }
        .alert:empty { display: none; }
        label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85em; margin-top: 15px; color: #4a5568; }
        input { width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box; font-size: 16px; margin-bottom: 5px; }
        button { width: 100%; padding: 12px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 15px; transition: 0.2s; margin-top: 10px; }
        .btn-check { background: #718096; color: white; }
        .btn-save { background: #3182ce; color: white; }
        .btn-bulk { background: #38a169; color: white; }
        .btn-export { background: #4a5568; color: white; }
        .btn-del { background: #e53e3e; color: white; }
        .section { background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #edf2f7; margin-top: 20px; }
        hr { border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🌐 Domain Manager</h2>
        <div class="alert">${message}</div>

        <form method="POST" enctype="multipart/form-data">
          <label>Target Domain / Subdomain</label>
          <input type="text" name="domain" value="${valDomain}" placeholder="contoh: sub.domain.com">
          <button type="submit" name="action" value="check" class="btn-check">🔍 Cek / Cari Data</button>

          <div class="section">
            <label>📌 Pinterest Code</label>
            <input type="text" name="p_code" value="${valPCode}">
            <label>📊 Histats ID</label>
            <input type="text" name="h_id" value="${valHId}">
          </div>

          <div class="section" style="border: 2px dashed #38a169; background: #f0fff4;">
            <label>📤 Bulk Upload (CSV)</label>
            <input type="file" name="csv_file" accept=".csv">
            <p style="font-size: 0.7em; color: #48bb78; margin-bottom: 5px;">Format: subdomain,kodepinterest,idhistats</p>
            <button type="submit" name="action" value="bulk" class="btn-bulk">⬆️ Upload CSV</button>
          </div>

          <div class="section">
            <label>📥 Export Data</label>
            <p style="font-size: 0.7em; color: #718096; margin-bottom: 5px;">Download semua data di KV menjadi file CSV.</p>
            <button type="submit" name="action" value="export" class="btn-export">📥 Download Backup CSV</button>
          </div>

          <hr>
          
          <label>Password Admin</label>
          <input type="password" name="password" required placeholder="Wajib diisi...">

          <button type="submit" name="action" value="save" class="btn-save">💾 Simpan Perubahan Manual</button>
          
          ${searchResult ? `
          <button type="submit" name="action" value="delete" class="btn-del" onclick="return confirm('Yakin hapus data ini?');">🗑️ Hapus Data Domain Ini</button>
          ` : ''}
        </form>
      </div>
    </body>
    </html>
  `;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
