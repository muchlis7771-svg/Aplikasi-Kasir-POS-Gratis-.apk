// Kirim push Firebase Cloud Messaging (FCM HTTP v1) dari Cloudflare Worker.
// Memakai service account (secret FCM_SERVICE_ACCOUNT berisi JSON). Jika secret kosong,
// fungsi mengembalikan false dan aplikasi memakai polling sebagai cadangan.

let _tok = { value: null, exp: 0 };

function b64url(input) {
  const s = typeof input === "string" ? btoa(input) : btoa(String.fromCharCode(...new Uint8Array(input)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToBuf(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function accessToken(sa) {
  if (_tok.value && _tok.exp > Date.now() + 60000) return _tok.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const input = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBuf(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  const jwt = input + "." + b64url(sig);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("FCM token gagal: " + JSON.stringify(j));
  _tok = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return _tok.value;
}

/** Kirim data message ke satu perangkat. Kembalikan true bila terkirim. */
export async function sendPush(env, token, data) {
  if (!env.FCM_SERVICE_ACCOUNT || !token) return false;
  let sa;
  try { sa = JSON.parse(env.FCM_SERVICE_ACCOUNT); } catch { return false; }
  try {
    const at = await accessToken(sa);
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, data, android: { priority: "high" } } }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}
