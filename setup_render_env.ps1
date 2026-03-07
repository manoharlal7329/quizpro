# setup_render_env.ps1
# =====================================================
# QuizPro Render Environment Setup Script
# Run this ONCE after getting your Render API key
# =====================================================
# 
# HOW TO GET RENDER API KEY:
# 1. Go to https://dashboard.render.com/u/settings
# 2. Click "API Keys" 
# 3. Create a new key and paste it below
#
# HOW TO GET SERVICE ID:
# 1. Open your Render service
# 2. Look at the URL: dashboard.render.com/web/srv-XXXXXXXX
# 3. Copy "srv-XXXXXXXX" and paste below
# =====================================================

$RENDER_API_KEY = "YOUR_RENDER_API_KEY_HERE"   # <-- Paste your API key
$RENDER_SERVICE_ID = "YOUR_RENDER_SERVICE_ID_HERE" # <-- e.g. srv-abc123

$envVars = @(
    @{ key = "MONGODB_URI"; value = "mongodb+srv://quizuser:quizuser%402005@cluster0.nuxswgz.mongodb.net/QuizPro_Winner?appName=Cluster0" },
    @{ key = "JWT_SECRET"; value = "quizpro_super_secret_key_2026" },
    @{ key = "RAZORPAY_KEY_ID"; value = "rzp_live_SO3GQfqDPYb9sB" },
    @{ key = "RAZORPAY_KEY_SECRET"; value = "POQIC8C7SlLRtm6IqsWnj0vR" },
    @{ key = "RAZORPAY_WEBHOOK_SECRET"; value = "your_webhook_secret_here" },
    @{ key = "PLATFORM_FEE_PERCENT"; value = "0" },
    @{ key = "OTP_PROVIDER"; value = "console" },
    @{ key = "DEMO_OTP_MODE"; value = "false" },
    @{ key = "SUPPORT_EMAIL"; value = "manoharlala02911@gmail.com" },
    @{ key = "SUPPORT_UPI"; value = "manoharlala02911-2@okaxis" },
    @{ key = "WELCOME_DEMO_BONUS"; value = "0" },
    @{ key = "RAZORPAY_PAYOUT_ACCOUNT"; value = "12345678901234" },
    @{ key = "AUTO_PAYOUT_ENABLED"; value = "true" },
    @{ key = "PAYMENT_GATEWAY"; value = "RAZORPAY" }
)

$headers = @{
    "Authorization" = "Bearer $RENDER_API_KEY"
    "Content-Type"  = "application/json"
}

$body = $envVars | ConvertTo-Json
$url = "https://api.render.com/v1/services/$RENDER_SERVICE_ID/env-vars"

Write-Host "`n📡 Sending environment variables to Render..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method PUT -Headers $headers -Body $body
    Write-Host "✅ SUCCESS! All env vars set on Render." -ForegroundColor Green
    Write-Host "   Render will auto-redeploy now." -ForegroundColor Green
}
catch {
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure API key and Service ID are correct." -ForegroundColor Yellow
}
