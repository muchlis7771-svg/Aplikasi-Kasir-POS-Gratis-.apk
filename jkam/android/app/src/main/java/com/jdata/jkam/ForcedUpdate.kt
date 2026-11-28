package com.jdata.jkam

import android.content.DialogInterface
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

/**
 * Pembaruan WAJIB saat aplikasi dibuka (user, owner, headadmin).
 * Jika server punya versi lebih baru, tampilkan dialog yang TIDAK bisa ditutup
 * sampai aplikasi diperbarui. Kalau tidak ada internet / gagal cek, user tetap
 * boleh memakai aplikasi (hanya memblokir bila yakin ada versi lebih baru).
 */
object ForcedUpdate {

    @Volatile private var checking = false
    private var dialog: AlertDialog? = null

    private fun buildNum(v: String?) = v?.substringAfterLast('.')?.toIntOrNull() ?: 0

    /** filename APK sesuai peran aplikasi ini. */
    private fun apkName() = "jkam-" + BuildConfig.ROLE + ".apk"

    fun gate(act: AppCompatActivity) {
        if (checking || dialog?.isShowing == true) return
        checking = true
        val p = Prefs(act)
        Thread {
            val r = Api.call(p.serverUrl, "/api/public/apps")
            val server = r.json.optString("version", "")
            val mustUpdate = r.ok && buildNum(server) > buildNum(BuildConfig.VERSION_NAME)
            act.runOnUiThread {
                checking = false
                if (mustUpdate && !act.isFinishing) showBlocking(act, server)
            }
        }.start()
    }

    private fun showBlocking(act: AppCompatActivity, server: String) {
        if (dialog?.isShowing == true) return
        val p = Prefs(act)
        val url = p.serverUrl + "/download/" + apkName()
        val d = AlertDialog.Builder(act)
            .setTitle("Pembaruan wajib (v$server)")
            .setMessage("Versi baru JKam tersedia dan harus dipasang untuk melanjutkan.")
            .setCancelable(false)
            .setPositiveButton("Perbarui sekarang", null) // diisi manual agar tidak menutup dialog
            .create()
        d.setCanceledOnTouchOutside(false)
        d.setOnShowListener {
            d.getButton(DialogInterface.BUTTON_POSITIVE).setOnClickListener {
                if (!AppUpdater.canInstall(act)) {
                    d.setMessage("Izinkan \"Pasang aplikasi tak dikenal\" untuk JKam, lalu tekan Perbarui lagi.")
                    AppUpdater.openInstallSettings(act)
                    return@setOnClickListener
                }
                AppUpdater.downloadAndInstall(act, url) { s -> d.setMessage(s) }
            }
        }
        dialog = d
        d.show()
        // Coba langsung unduh+pasang begitu dialog muncul (paksa), bila izin sudah ada.
        if (AppUpdater.canInstall(act)) AppUpdater.downloadAndInstall(act, url) { s -> d.setMessage(s) }
    }
}
