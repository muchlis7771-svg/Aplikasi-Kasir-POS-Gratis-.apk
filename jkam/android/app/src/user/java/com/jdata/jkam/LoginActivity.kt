package com.jdata.jkam

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val p = Prefs(this)
        if (p.loggedIn) { openMain(); return }

        setContentView(R.layout.activity_login)
        val server = findViewById<EditText>(R.id.server)
        val serverBox = findViewById<View>(R.id.serverBox)
        val username = findViewById<EditText>(R.id.username)
        val password = findViewById<EditText>(R.id.password)
        val error = findViewById<TextView>(R.id.error)
        val btn = findViewById<Button>(R.id.login)
        val progress = findViewById<ProgressBar>(R.id.progress)
        val change = findViewById<TextView>(R.id.changeServer)

        server.setText(p.serverUrl)
        username.setText(p.username)
        // Server sudah tertanam di APK -> sembunyikan, bisa dibuka lewat "Ubah alamat server"
        serverBox.visibility = if (p.serverUrl.isBlank()) View.VISIBLE else View.GONE
        change.visibility = if (p.serverUrl.isBlank()) View.GONE else View.VISIBLE
        change.setOnClickListener { serverBox.visibility = View.VISIBLE; change.visibility = View.GONE }

        btn.setOnClickListener {
            var url = server.text.toString().trim().trimEnd('/')
            if (url.isNotEmpty() && !url.startsWith("http")) url = "https://$url"
            val u = username.text.toString().trim().lowercase()
            val pw = password.text.toString()
            if (url.isBlank() || u.isBlank() || pw.isBlank()) {
                error.text = "Lengkapi server, username dan password"; error.visibility = View.VISIBLE; return@setOnClickListener
            }
            error.visibility = View.GONE
            btn.isEnabled = false; progress.visibility = View.VISIBLE
            Thread {
                val r = Api.call(url, "/api/auth/login", "POST", null,
                    JSONObject().put("username", u).put("password", pw).put("app", "user"))
                runOnUiThread {
                    btn.isEnabled = true; progress.visibility = View.GONE
                    if (r.ok) {
                        val acc = r.json.getJSONObject("account")
                        p.serverUrl = url
                        p.token = r.json.getString("token")
                        p.username = u
                        p.userName = acc.optString("name", u)
                        UploadWorker.enqueueAll(this, replace = true) // kirim rekaman lama yang tertunda
                        openMain()
                    } else {
                        error.text = r.error; error.visibility = View.VISIBLE
                    }
                }
            }.start()
        }
    }

    private fun openMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
