package com.jdata.jkam

import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Panggilan HTTP sederhana ke JKam Worker. Jalankan di thread latar. */
object Api {
    val deviceName: String get() = (Build.MANUFACTURER.replaceFirstChar { it.uppercase() } + " " + Build.MODEL).take(80)

    data class Res(val code: Int, val json: JSONObject) {
        val ok get() = code in 200..299
        val error get() = json.optString("error", if (code == -1) "Tidak bisa terhubung ke server" else "Gagal ($code)")
    }

    fun call(server: String, path: String, method: String = "GET", token: String? = null, body: JSONObject? = null): Res {
        return try {
            val c = (URL(server.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 15_000
                readTimeout = 20_000
                setRequestProperty("Content-Type", "application/json")
                if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
            }
            if (body != null) {
                c.doOutput = true
                c.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val code = c.responseCode
            val text = (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
            c.disconnect()
            Res(code, try { JSONObject(text) } catch (_: Exception) { JSONObject() })
        } catch (e: Exception) {
            Res(-1, JSONObject().put("error", "Tidak bisa terhubung ke server"))
        }
    }

    fun heartbeat(p: Prefs, recording: Boolean) {
        if (!p.loggedIn) return
        call(p.serverUrl, "/api/user/heartbeat", "POST", p.token,
            JSONObject().put("recording", recording).put("device", deviceName))
    }
}
