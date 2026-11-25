package com.jdata.jkam

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Cadangan saat aplikasi tertutup: tiap ~15 menit memeriksa perintah dari Owner.
 * Bila ada perintah "mulai" dan belum merekam, tampilkan notifikasi untuk dibuka user.
 * (Saat aplikasi terbuka, MainActivity memeriksa jauh lebih cepat; saat merekam,
 * RecorderService menangani perintah "stop".)
 */
class CommandWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val p = Prefs(applicationContext)
        if (!p.loggedIn || !p.remoteControl) return Result.success()
        if (RecorderService.running) return Result.success()
        val cmd = Api.command(p) ?: return Result.success()
        if (cmd.first == "start") {
            Api.ackCommand(p, cmd.second)             // ack agar tidak diingatkan berulang
            CommandNotif.showStartRequest(applicationContext)
        } else if (cmd.first == "stop") {
            Api.ackCommand(p, cmd.second)             // tidak sedang merekam, anggap selesai
        }
        return Result.success()
    }

    companion object {
        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<CommandWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .addTag("jkam-cmd")
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("jkam-cmd", ExistingPeriodicWorkPolicy.UPDATE, req)
        }

        fun cancel(ctx: Context) {
            WorkManager.getInstance(ctx).cancelUniqueWork("jkam-cmd")
        }
    }
}
