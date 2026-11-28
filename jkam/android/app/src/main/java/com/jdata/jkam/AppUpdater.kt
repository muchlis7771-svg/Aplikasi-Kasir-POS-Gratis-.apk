package com.jdata.jkam

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Mengunduh APK terbaru dan membuka pemasang Android (user tetap menekan "Pasang"). */
object AppUpdater {
    @Volatile private var busy = false
    private val main = Handler(Looper.getMainLooper())

    fun canInstall(ctx: Context): Boolean =
        android.os.Build.VERSION.SDK_INT < 26 || ctx.packageManager.canRequestPackageInstalls()

    /** Buka pengaturan "Pasang aplikasi tak dikenal" untuk JKam. */
    fun openInstallSettings(ctx: Context) {
        try {
            ctx.startActivity(
                Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.packageName))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Exception) {}
    }

    fun downloadAndInstall(ctx: Context, url: String, status: (String) -> Unit) {
        if (busy) { status("Sedang mengunduh…"); return }
        busy = true
        status("Mengunduh pembaruan…")
        Thread {
            try {
                val dir = File(ctx.getExternalFilesDir(null), "update").apply { mkdirs() }
                val apk = File(dir, "jkam-update.apk")
                if (apk.exists()) apk.delete()
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 20_000; readTimeout = 180_000
                }
                val code = conn.responseCode
                if (code !in 200..299) { conn.disconnect(); fail(status, "Pembaruan belum tersedia"); return@Thread }
                conn.inputStream.use { inp -> apk.outputStream().use { inp.copyTo(it, 64 * 1024) } }
                conn.disconnect()
                if (apk.length() < 10_000) { fail(status, "File pembaruan tidak valid"); return@Thread }
                val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".fileprovider", apk)
                val install = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                main.post { try { ctx.startActivity(install); status("Membuka pemasang…") } catch (_: Exception) { status("Gagal membuka pemasang") } }
            } catch (e: Exception) {
                fail(status, "Gagal mengunduh pembaruan")
            } finally {
                busy = false
            }
        }.start()
    }

    private fun fail(status: (String) -> Unit, msg: String) = main.post { status(msg) }
}
