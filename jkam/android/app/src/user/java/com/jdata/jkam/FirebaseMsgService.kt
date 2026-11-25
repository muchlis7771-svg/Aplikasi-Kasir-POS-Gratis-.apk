package com.jdata.jkam

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** Menerima push perintah mulai/stop dari server (instan, walau aplikasi tertutup). */
class FirebaseMsgService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        val p = Prefs(this)
        if (p.loggedIn) Thread { Api.uploadFcmToken(p, token) }.start()
    }

    override fun onMessageReceived(msg: RemoteMessage) {
        val p = Prefs(this)
        if (!p.loggedIn || !p.remoteControl) return
        val d = msg.data
        if (d["type"] != "command") return
        val action = d["action"] ?: return
        val createdAt = d["created_at"]?.toLongOrNull() ?: 0L
        Thread { Api.ackCommand(p, createdAt) }.start()
        when (action) {
            // Transparan: hanya menampilkan permintaan. User menekan "Ya, mulai" untuk merekam.
            "start" -> if (!RecorderService.running) CommandNotif.showStartRequest(this)
            "stop" -> if (RecorderService.running) {
                CommandNotif.show(this, "JKam dihentikan Owner", "Owner meminta rekaman dihentikan.")
                RecorderService.stop(this)
            }
        }
    }

    companion object {
        /** Ambil token FCM dan kirim ke server. Aman dipanggil walau Firebase belum dikonfigurasi. */
        fun registerToken(ctx: Context) {
            try {
                FirebaseMessaging.getInstance().token.addOnCompleteListener { t ->
                    if (t.isSuccessful && t.result != null) {
                        val p = Prefs(ctx)
                        if (p.loggedIn) Thread { Api.uploadFcmToken(p, t.result) }.start()
                    }
                }
            } catch (_: Throwable) {
                // Firebase tidak dikonfigurasi (google-services.json tidak ada) -> pakai polling.
            }
        }
    }
}
