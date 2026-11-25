package com.jdata.jkam

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/** Notifikasi untuk perintah mulai/stop dari Owner. */
object CommandNotif {
    private const val CHANNEL = "jkam_cmd"
    private const val ID = 21

    private fun channel(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Perintah Owner", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Permintaan mulai/stop rekam dari Owner"
                }
            )
        }
    }

    /** Notifikasi informasi biasa (mis. rekaman dihentikan Owner). */
    fun show(ctx: Context, title: String, text: String) {
        channel(ctx)
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        ctx.getSystemService(NotificationManager::class.java).notify(ID, n)
    }

    /**
     * Permintaan MULAI rekam. Android melarang mulai mikrofon dari latar belakang,
     * jadi notifikasi ini membuka JKam saat diketuk, lalu perekaman dimulai dari depan
     * (indikator rekam tetap tampil — transparan, bukan diam-diam).
     */
    fun showStartRequest(ctx: Context) {
        channel(ctx)
        val intent = Intent(ctx, MainActivity::class.java)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("start_cmd", true)
        val pi = PendingIntent.getActivity(
            ctx, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("Owner meminta mulai merekam")
            .setContentText("Ketuk untuk membuka JKam dan mulai merekam.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        ctx.getSystemService(NotificationManager::class.java).notify(ID, n)
    }
}
