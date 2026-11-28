package com.jdata.jkam

import android.content.Context

/** Operasi perintah bersama yang dipakai poller, FCM, dan WorkManager. */
object CommandOps {

    /**
     * Owner melepas perangkat dari dashboard:
     *  - lepas perlindungan anti-copot (admin/owner) -> aplikasi bisa dihapus
     *  - hapus PIN -> aplikasi bisa dibuka tanpa PIN
     *  - hentikan rekaman & matikan layanan siaga
     */
    fun release(ctx: Context) {
        try { DeviceLock.release(ctx) } catch (_: Exception) {}
        try { AppLock.clear(Prefs(ctx)) } catch (_: Exception) {}
        try { RecorderService.shutdown(ctx) } catch (_: Exception) {}
        try {
            CommandNotif.show(ctx, "Perangkat dilepas Owner",
                "Perlindungan dan PIN dilepas. Aplikasi JKam kini bisa dihapus.")
        } catch (_: Exception) {}
    }
}
