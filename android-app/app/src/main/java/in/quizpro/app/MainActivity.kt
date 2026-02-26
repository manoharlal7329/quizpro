package in.quizpro.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.view.View
import android.webkit.*
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar

    // ✅ PRODUCTION: Points to your Render domain
    private val APP_URL = "https://quizpro-takb.onrender.com"
    // 🧪 TESTING (Localhost via tunnel): Uncomment below if needed
    // private val APP_URL = "https://xxxx-xxxx.ngrok-free.app"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView       = findViewById(R.id.webView)
        swipeRefresh  = findViewById(R.id.swipeRefresh)
        progressBar   = findViewById(R.id.progressBar)

        setupWebView()
        setupSwipeRefresh()

        webView.loadUrl(APP_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings

        // ── JavaScript & Modern Web APIs ──────────────────────────────────────
        settings.javaScriptEnabled        = true
        settings.domStorageEnabled        = true       // localStorage support
        settings.databaseEnabled          = true
        settings.allowFileAccess          = true
        settings.javaScriptCanOpenWindowsAutomatically = true

        // ── Layout & Display ──────────────────────────────────────────────────
        settings.useWideViewPort          = true
        settings.loadWithOverviewMode     = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls      = false
        settings.displayZoomControls      = false

        // ── Cache: Use cache when available ───────────────────────────────────
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        // ── User Agent: Identify as Android app ───────────────────────────────
        settings.userAgentString = settings.userAgentString + " QuizProApp/1.0"

        // ── WebViewClient: Handle navigation ─────────────────────────────────
        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return when {
                    // Let payment pages (Razorpay) open in browser
                    url.contains("razorpay.com") || url.startsWith("upi://") -> {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        true
                    }
                    // All our domain URLs stay in app
                    url.startsWith(APP_URL) || url.startsWith("https://quizpro-takb.onrender.com") -> false
                    // External URLs open in browser
                    else -> {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        true
                    }
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                // Show offline page if network error
                if (request.isForMainFrame) {
                    webView.loadData(offlinePage(), "text/html", "UTF-8")
                }
            }
        }

        // ── WebChromeClient: File upload + console logs ────────────────────
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
                progressBar.progress = newProgress
            }

            // File chooser for Excel upload in admin panel
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                val intent = fileChooserParams.createIntent()
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST)
                    filePathCallbackGlobal = filePathCallback
                } catch (e: Exception) {
                    filePathCallback.onReceiveValue(null)
                }
                return true
            }

            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                android.util.Log.d("QuizPro", "${message.message()} -- From line ${message.lineNumber()}")
                return true
            }
        }

        // Enable mixed content (needed for some payment flows)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(
            resources.getColor(R.color.colorPrimary, theme)
        )
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    // ── Back button: Navigate in app history ─────────────────────────────────
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    // ── File chooser result ───────────────────────────────────────────────────
    private var filePathCallbackGlobal: ValueCallback<Array<Uri>>? = null

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val result = if (resultCode == Activity.RESULT_OK && data != null) {
                arrayOf(data.data ?: return)
            } else null
            filePathCallbackGlobal?.onReceiveValue(result)
            filePathCallbackGlobal = null
        }
    }

    // ── Offline page ──────────────────────────────────────────────────────────
    private fun offlinePage() = """
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body{font-family:sans-serif;background:#0a0a14;color:#f1f5f9;display:flex;flex-direction:column;
               align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}
          h1{font-size:2rem;margin-bottom:8px}
          p{color:#64748b;margin-bottom:32px}
          button{background:linear-gradient(135deg,#7c3aed,#0ea5e9);color:#fff;border:none;
                 border-radius:50px;padding:14px 32px;font-size:1rem;font-weight:700;cursor:pointer}
        </style>
        </head>
        <body>
          <div style="font-size:4rem">📡</div>
          <h1>No Connection</h1>
          <p>Internet nahi lag raha. Check karo aur retry karo.</p>
          <button onclick="window.location.reload()">🔄 Retry</button>
        </body>
        </html>
    """.trimIndent()

    companion object {
        private const val FILE_CHOOSER_REQUEST = 100
    }
}
