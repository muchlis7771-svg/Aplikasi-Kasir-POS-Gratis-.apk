package com.jdata.jkam

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Mengunggah satu potongan rekaman ke Cloudflare. Nama file berisi metadata:
 *   <sessionId>_<seq>_<startedAtMs>_<durationMs>_<enhanced>.m4a
 * File dihapus dari HP setelah berhasil terunggah. Gagal = dicoba ulang otomatis.
 */
class UploadWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    override fun doWork(): Result {
        val path = inputData.getString("path") ?: return Result.failure()
        val file = File(path)
        if (!file.exists()) return Result.success()
        val parts = file.nameWithoutExtension.split("_")
        if (parts.size < 5) return Result.failure()

        val p = Prefs(applicationContext)
        if (!p.loggedIn) return Result.retry()

        return try {
            val conn = (URL(p.serverUrl + "/api/upload").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 20_000
                readTimeout = 120_000
                setFixedLengthStreamingMode(file.length())
                setRequestProperty("Authorization", "Bearer " + p.token)
                setRequestProperty("Content-Type", "audio/mp4")
                setRequestProperty("X-Device", Api.deviceName)
                setRequestProperty("X-Session-Id", parts[0])
                setRequestProperty("X-Seq", parts[1])
                setRequestProperty("X-Started-At", parts[2])
                setRequestProperty("X-Duration-Ms", parts[3])
                setRequestProperty("X-Enhanced", parts[4])
            }
            file.inputStream().use { input -> conn.outputStream.use { input.copyTo(it, 64 * 1024) } }
            val code = conn.responseCode
            conn.disconnect()
            when (code) {
                in 200..299 -> { file.delete(); Result.success() }
                400, 413, 415 -> Result.failure()
                // 401 sesi habis, 402 lisensi owner habis, 403 owner suspend, 507 kuota penuh, 5xx:
                // file tetap disimpan di HP dan dicoba lagi otomatis.
                else -> Result.retry()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        fun pendingDir(ctx: Context) = File(ctx.filesDir, "pending").apply { mkdirs() }

        fun enqueue(ctx: Context, file: File) {
            val net = if (Prefs(ctx).wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
            val req = OneTimeWorkRequestBuilder<UploadWorker>()
                .setInputData(workDataOf("path" to file.absolutePath))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(net).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .addTag("jkam-upload")
                .build()
            WorkManager.getInstance(ctx).enqueueUniqueWork("up_" + file.name, ExistingWorkPolicy.KEEP, req)
        }

        /** Antrekan ulang semua file yang belum terkirim (mis. setelah ganti server/key). */
        fun enqueueAll(ctx: Context, replace: Boolean = false) {
            pendingDir(ctx).listFiles { f -> f.extension == "m4a" }?.forEach {
                if (replace) WorkManager.getInstance(ctx).cancelUniqueWork("up_" + it.name)
                enqueue(ctx, it)
            }
        }

        fun pendingCount(ctx: Context) = pendingDir(ctx).listFiles { f -> f.extension == "m4a" }?.size ?: 0
    }
}
