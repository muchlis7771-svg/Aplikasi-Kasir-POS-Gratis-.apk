package com.jdata.jkam

import android.content.Context

class Prefs(ctx: Context) {
    private val sp = ctx.getSharedPreferences("jkam", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = (sp.getString("server", null) ?: BuildConfig.SERVER_URL).trim().trimEnd('/')
        set(v) = sp.edit().putString("server", v.trim().trimEnd('/')).apply()
    var token: String
        get() = sp.getString("token", "") ?: ""
        set(v) = sp.edit().putString("token", v).apply()
    var userName: String
        get() = sp.getString("uname", "") ?: ""
        set(v) = sp.edit().putString("uname", v).apply()
    var username: String
        get() = sp.getString("username", "") ?: ""
        set(v) = sp.edit().putString("username", v).apply()
    var chunkMinutes: Int
        get() = sp.getInt("chunk", 5)
        set(v) = sp.edit().putInt("chunk", v.coerceIn(1, 60)).apply()
    var maxHours: Int
        get() = sp.getInt("maxh", 24)
        set(v) = sp.edit().putInt("maxh", v.coerceIn(0, 240)).apply()
    var enhance: Boolean
        get() = sp.getBoolean("enhance", true)
        set(v) = sp.edit().putBoolean("enhance", v).apply()
    var voiceMode: Boolean
        get() = sp.getBoolean("voice", false)
        set(v) = sp.edit().putBoolean("voice", v).apply()
    var wifiOnly: Boolean
        get() = sp.getBoolean("wifi", false)
        set(v) = sp.edit().putBoolean("wifi", v).apply()
    var remoteControl: Boolean
        get() = sp.getBoolean("remote", true)
        set(v) = sp.edit().putBoolean("remote", v).apply()
    var standbyMode: Boolean
        get() = sp.getBoolean("standby", true)
        set(v) = sp.edit().putBoolean("standby", v).apply()
    var autoUpdate: Boolean
        get() = sp.getBoolean("autoupd", true)
        set(v) = sp.edit().putBoolean("autoupd", v).apply()
    var updateHandled: String  // versi yang sudah ditawarkan agar tidak berulang
        get() = sp.getString("updver", "") ?: ""
        set(v) = sp.edit().putString("updver", v).apply()
    /** 0 = hemat 32k, 1 = standar 48k, 2 = tinggi 96k */
    var quality: Int
        get() = sp.getInt("quality", 1)
        set(v) = sp.edit().putInt("quality", v.coerceIn(0, 2)).apply()

    // --- Kunci PIN aplikasi (perekam) ---
    var pinHash: String
        get() = sp.getString("pinhash", "") ?: ""
        set(v) = sp.edit().putString("pinhash", v).apply()
    var pinSalt: String
        get() = sp.getString("pinsalt", "") ?: ""
        set(v) = sp.edit().putString("pinsalt", v).apply()
    val hasPin: Boolean get() = pinHash.isNotBlank()

    // --- Perlindungan anti-copot (device admin/owner) ---
    var protectionWanted: Boolean
        get() = sp.getBoolean("protect", false)
        set(v) = sp.edit().putBoolean("protect", v).apply()

    val bitRate: Int get() = when (quality) { 0 -> 32000; 2 -> 96000; else -> 48000 }
    val loggedIn: Boolean get() = token.isNotBlank() && serverUrl.isNotBlank()

    fun logout() = sp.edit().remove("token").remove("uname").remove("username").apply()
}
