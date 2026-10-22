plugins {
    id("com.android.library") version "8.7.3"
    id("org.jetbrains.kotlin.android") version "2.0.21"
}
android {
    namespace = "app.resetwatch.securesession"
    compileSdk = 35
    defaultConfig { minSdk = 23 }
    sourceSets.getByName("main").java.srcDir("../../../apps/client/uni_modules/resetwatch-secure-session/utssdk/app-android")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
