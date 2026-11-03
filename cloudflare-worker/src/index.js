const PROJECT_ID = "triohnte-database";
const API_KEY = "AIzaSyAajz5PVa79vH1FSWrC0pPrGxs0Q-9xkFk";
const DB_URL = "https://triohnte-database-default-rtdb.europe-west1.firebasedatabase.app";

function b64url(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function jsonResponse(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      "cache-control": "no-store"
    }
  });
}
function corsOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ["https://awgabry.github.io"];
  return allowed.includes(origin) ? origin : "https://awgabry.github.io";
}
async function verifyFirebaseUser(idToken) {
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + API_KEY, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (!response.ok) throw new Error("Sessão Firebase inválida.");
  const result = await response.json();
  const user = result.users && result.users[0];
  if (!user || !user.localId || user.disabled) throw new Error("Utilizador Firebase inválido.");
  return user.localId;
}
async function serviceAccessToken(env) {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/firebase.database",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claim;
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const assertion = unsigned + "." + b64url(signature);
  const tokenResponse = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!tokenResponse.ok) throw new Error("Não foi possível obter autorização do Firebase.");
  return (await tokenResponse.json()).access_token;
}
async function readDatabase(path, accessToken) {
  const response = await fetch(DB_URL + "/" + path + ".json?access_token=" + encodeURIComponent(accessToken));
  if (!response.ok) throw new Error("Falha ao consultar os dados do Firebase.");
  return response.json();
}
async function sendPush(token, title, body, link, accessToken) {
  return fetch("https://fcm.googleapis.com/v1/projects/" + PROJECT_ID + "/messages:send", {
    method: "POST",
    headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        webpush: {
          fcm_options: { link },
          notification: { icon: "https://awgabry.github.io/Triohnte/mu.png", badge: "https://awgabry.github.io/Triohnte/mu.png" }
        }
      }
    })
  });
}

export default {
  async fetch(request, env) {
    const origin = corsOrigin(request);
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "86400"
      }
    });
    if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405, origin);

    try {
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return jsonResponse({ error: "Autenticação necessária." }, 401, origin);
      const uid = await verifyFirebaseUser(auth.slice(7));
      const payload = await request.json();
      const source = payload.source;
      const id = String(payload.id || "");
      if (!["forum", "novidade"].includes(source) || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) {
        return jsonResponse({ error: "Evento inválido." }, 400, origin);
      }

      const dedupeKey = source + ":" + id;
      if (await env.PUSH_DEDUPE.get(dedupeKey)) return jsonResponse({ sent: 0, duplicate: true }, 200, origin);

      const accessToken = await serviceAccessToken(env);
      let item;
      if (source === "forum") item = await readDatabase("posts/" + id, accessToken);
      else item = await readDatabase("novidades_publicas/" + id, accessToken);
      if (!item) return jsonResponse({ error: "Conteúdo não encontrado." }, 404, origin);
      if (source === "forum" && item.uid !== uid) return jsonResponse({ error: "Só o autor pode anunciar esta publicação." }, 403, origin);

      const title = source === "forum" ? "Nova publicação no Fórum" : (item.titulo || "Nova novidade no Triohnte");
      const rawBody = source === "forum" ? ((item.author || "Utilizador") + ": " + (item.content || "")) : (item.descricao || "");
      const body = String(rawBody).replace(/\s+/g, " ").slice(0, 150) || "Há conteúdo novo no Triohnte.";
      const link = source === "forum" ? "https://awgabry.github.io/Triohnte/#forum" : "https://awgabry.github.io/Triohnte/index.html";
      const tokenGroups = await readDatabase("fcmTokens", accessToken) || {};
      const targets = [];
      for (const [userId, records] of Object.entries(tokenGroups)) {
        if (!records || typeof records !== "object") continue;
        for (const [key, record] of Object.entries(records)) {
          if (record && record.active !== false && typeof record.token === "string") {
            targets.push({ userId, key, token: record.token });
          }
        }
      }

      let sent = 0;
      await Promise.all(targets.map(async target => {
        const response = await sendPush(target.token, title, body, link, accessToken);
        if (response.ok) sent++;
        else if (response.status === 404 || response.status === 400) {
          // Tokens expirados serão ignorados; o utilizador pode voltar a ativar no dispositivo.
        }
      }));
      await env.PUSH_DEDUPE.put(dedupeKey, String(Date.now()), { expirationTtl: 60 * 60 * 24 * 30 });
      return jsonResponse({ sent, total: targets.length }, 200, origin);
    } catch (error) {
      return jsonResponse({ error: error.message || "Erro interno." }, 500, origin);
    }
  }
};
