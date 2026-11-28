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
        if (!p.loggedIn) return
        val d = msg.data
        if (d["type"] != "command") return
        val action = d["action"] ?: return
        // "release" (owner melepas perangkat) selalu diproses; perintah lain butuh kendali jarak jauh aktif.
        if (action != "release" && !p.remoteControl) return
        val createdAt = d["created_at"]?.toLongOrNull() ?: 0L
        Thread { Api.ackCommand(p, createdAt) }.start()
        when (action) {
            "start" -> if (!RecorderService.running) {
                if (RecorderService.alive && p.standbyMode) {
                    // Mode Siaga: layanan sudah hidup dari depan -> mulai langsung TANPA user mengetuk.
                    // Notifikasi "JKam sedang merekam" + titik hijau tetap tampil (tidak disembunyikan).
                    RecorderService.start(this)
                } else {
                    // Siaga mati / layanan belum hidup: tidak boleh mulai mikrofon dari latar belakang
                    // (Android 12+). Tampilkan permintaan, user menekan "Ya, mulai".
                    CommandNotif.showStartRequest(this)
                }
            }
            "stop" -> if (RecorderService.running) {
                CommandNotif.show(this, "JKam dihentikan Owner", "Owner meminta rekaman dihentikan.")
                RecorderService.stop(this)
            }
            "release" -> CommandOps.release(this)
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
