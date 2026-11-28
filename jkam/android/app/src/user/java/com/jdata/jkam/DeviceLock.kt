package com.jdata.jkam

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/** Penerima admin perangkat. Keberadaannya memungkinkan JKam memblokir pencopotan. */
class AdminReceiver : DeviceAdminReceiver() {
    // Peringatan jujur saat user mencoba menonaktifkan perlindungan lewat Pengaturan.
    override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
        "Menonaktifkan perlindungan JKam. Setelah ini aplikasi bisa dihapus dari perangkat."
}

/**
 * Perlindungan anti-copot.
 *  - Sebagai DEVICE OWNER (dipasang di perangkat yang di-reset/di-provision owner):
 *    pencopotan benar-benar diblokir (setUninstallBlocked) dan hanya owner yang bisa melepas.
 *  - Sebagai DEVICE ADMIN biasa (cukup disetujui user sekali, tanpa reset):
 *    Android mewajibkan menonaktifkan admin dulu sebelum menghapus — penghalang, bukan kunci total.
 *
 * Owner "melepas perangkat" dari dashboard -> perintah "release" -> release() dipanggil,
 * perlindungan dilepas sehingga aplikasi bisa dihapus.
 *
 * Catatan etika: tidak ada trik menutup paksa layar Pengaturan atau menyembunyikan tombol.
 * Perekaman tetap transparan (notifikasi + titik hijau).
 */
object DeviceLock {

    fun admin(ctx: Context) = ComponentName(ctx, AdminReceiver::class.java)
    private fun dpm(ctx: Context) = ctx.getSystemService(DevicePolicyManager::class.java)

    fun isAdminActive(ctx: Context): Boolean = dpm(ctx).isAdminActive(admin(ctx))
    fun isDeviceOwner(ctx: Context): Boolean = dpm(ctx).isDeviceOwnerApp(ctx.packageName)
    fun protectionActive(ctx: Context): Boolean = isDeviceOwner(ctx) || isAdminActive(ctx)

    /** Intent untuk meminta user menyetujui JKam sebagai admin perangkat (tanpa reset). */
    fun addAdminIntent(ctx: Context): Intent =
        Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin(ctx))
            .putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "Izinkan JKam melindungi diri agar tidak terhapus tanpa izin owner. " +
                "Owner dapat melepas perlindungan ini kapan saja dari dashboard.")

    /** Setelah admin/owner aktif: kunci pencopotan sekuat mungkin pada mode yang tersedia. */
    fun enableBlock(ctx: Context) {
        val d = dpm(ctx)
        if (d.isDeviceOwnerApp(ctx.packageName)) {
            try { d.setUninstallBlocked(admin(ctx), ctx.packageName, true) } catch (_: Exception) {}
        }
        // Device admin biasa: Android sudah mewajibkan nonaktif-admin sebelum uninstall.
    }

    /** Dipanggil saat owner melepas perangkat: buka semua kunci agar bisa dihapus. */
    fun release(ctx: Context) {
        val d = dpm(ctx)
        try {
            if (d.isDeviceOwnerApp(ctx.packageName)) {
                try { d.setUninstallBlocked(admin(ctx), ctx.packageName, false) } catch (_: Exception) {}
                try { d.clearDeviceOwnerApp(ctx.packageName) } catch (_: Exception) {}
            }
            if (d.isAdminActive(admin(ctx))) d.removeActiveAdmin(admin(ctx))
        } catch (_: Exception) {}
        Prefs(ctx).protectionWanted = false
    }
}
