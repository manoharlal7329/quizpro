# 📱 QuizPro — Android App

## Folder Structure
```
android-app/
├── app/
│   ├── src/main/
│   │   ├── java/in/quizpro/app/
│   │   │   ├── MainActivity.kt       ← WebView + all logic
│   │   │   └── SplashActivity.kt     ← Splash screen (2s)
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml    ← WebView layout
│   │   │   │   └── activity_splash.xml ← Splash layout
│   │   │   ├── values/
│   │   │   │   ├── strings.xml
│   │   │   │   ├── colors.xml
│   │   │   │   └── themes.xml
│   │   │   └── xml/
│   │   │       └── network_security_config.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## Step 1: Android Studio Install
1. Download: https://developer.android.com/studio
2. Install karke open karo

## Step 2: Project Open Karo
1. `File → Open` → `f:\Quiz New\android-app` folder select karo
2. Gradle sync hone do (2-5 min, internet chahiye)

## Step 3: Testing (Local)
1. `MainActivity.kt` mein line 19-20 pe URL change karo:
   ```kotlin
   // Comment out production URL:
   // private val APP_URL = "https://www.quizpro.in"
   // Uncomment ngrok URL:
   private val APP_URL = "https://YOUR-NGROK-URL.ngrok-free.app"
   ```
2. ngrok start karo: `ngrok http 9988`
3. Phone connect karo USB se → Developer mode ON
4. Android Studio → Run ▶️

## Step 4: Build Release APK/AAB
1. `Build → Generate Signed Bundle/APK`
2. `Android App Bundle (.aab)` select karo
3. Keystore banao (pehli baar) → file safe rakhna!
4. Release → Finish → `app-release.aab` milega

## Step 5: Play Store Upload
1. play.google.com/console open karo
2. New app → "QuizPro – Skill Based Learning Quiz"
3. Category: **Education**
4. AAB file upload karo
5. Privacy Policy: `https://www.quizpro.in/privacy`
6. Rating: Everyone (18+ self-declare)

## ⚠️ Before Play Store Release:
- [ ] `APP_URL` production URL set karo
- [ ] network_security_config.xml se ngrok entries hata do
- [ ] Signing keystore safely backup karo
- [ ] Screenshots prepare karo (6 required)

## Play Store Listing Copy
**App name:** QuizPro – Skill Based Learning Quiz  
**Short desc:** Skill-based online quizzes. Learn, compete, and win based on performance.  
**Category:** Education  
**Content rating:** Everyone / 18+  
