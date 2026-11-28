package com.jdata.jkam

import java.security.MessageDigest

/**
 * Kunci PIN aplikasi perekam. PIN hanya membatasi AKSES KE LAYAR aplikasi
 * (membuka pengaturan, mulai/berhenti manual). Ini TIDAK menyembunyikan
 * perekaman: notifikasi JKam dan titik hijau mikrofon Android tetap tampil.
 *
 * PIN disimpan sebagai hash SHA-256 bergaram, bukan teks asli.
 */
object AppLock {
    /** true setelah PIN benar dimasukkan; direset saat aplikasi ke latar belakang. */
    @Volatile var unlocked = false

    private fun hash(pin: String, salt: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest("$salt:$pin".toByteArray()).joinToString("") { "%02x".format(it) }
    }

    fun setPin(p: Prefs, pin: String) {
        if (p.pinSalt.isBlank()) {
            p.pinSalt = (System.nanoTime().toString() + "-" + (Math.random() * 1e9).toLong())
        }
        p.pinHash = hash(pin, p.pinSalt)
    }

    fun check(p: Prefs, pin: String): Boolean =
        p.hasPin && p.pinHash == hash(pin, p.pinSalt)

    fun clear(p: Prefs) {
        p.pinHash = ""
        unlocked = true // jangan kunci layar setelah PIN dihapus
    }
}
