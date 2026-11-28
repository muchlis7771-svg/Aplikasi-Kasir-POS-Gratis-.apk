package com.jdata.jkam

import android.graphics.Color
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat

/** Layar PIN: harus benar sebelum aplikasi bisa dipakai. Tidak bisa dilewati tombol back. */
class LockActivity : AppCompatActivity() {

    private lateinit var p: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        p = Prefs(this)
        if (!p.hasPin) { AppLock.unlocked = true; finish(); return }
        window.statusBarColor = Color.parseColor("#F4F6FB")
        window.navigationBarColor = Color.parseColor("#F4F6FB")
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true; isAppearanceLightNavigationBars = true
        }
        setContentView(R.layout.activity_lock)

        val pin = findViewById<EditText>(R.id.pin)
        val err = findViewById<TextView>(R.id.err)
        findViewById<Button>(R.id.unlock).setOnClickListener {
            if (AppLock.check(p, pin.text.toString())) {
                AppLock.unlocked = true
                finish()
            } else {
                err.text = "PIN salah"
                pin.text?.clear()
            }
        }
    }

    // Tombol back tidak membuka aplikasi — keluar ke layar utama HP.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { moveTaskToBack(true) }
}
