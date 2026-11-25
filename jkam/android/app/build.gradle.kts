plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Alamat server Worker, diisi dari GitHub Actions (variable JKAM_SERVER_URL). Boleh kosong:
// aplikasi akan menanyakan alamat server saat pertama dibuka.
val serverUrl = (System.getenv("JKAM_SERVER_URL") ?: "").trim().trimEnd('/')
val runNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.jdata.jkam"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.jdata.jkam"
        minSdk = 26
        targetSdk = 34
        versionCode = runNumber
        versionName = "1.0.$runNumber"
        buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")
    }

    buildFeatures { buildConfig = true }

    flavorDimensions += "role"
    productFlavors {
        create("headadmin") {
            dimension = "role"
            applicationIdSuffix = ".headadmin"
            resValue("string", "app_name", "JKam Admin")
            buildConfigField("String", "ROLE", "\"headadmin\"")
        }
        create("owner") {
            dimension = "role"
            applicationIdSuffix = ".owner"
            resValue("string", "app_name", "JKam Owner")
            buildConfigField("String", "ROLE", "\"owner\"")
        }
        create("user") {
            dimension = "role"
            applicationIdSuffix = ".user"
            resValue("string", "app_name", "JKam")
            buildConfigField("String", "ROLE", "\"user\"")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Ditandatangani debug key agar APK langsung bisa diinstal (bukan untuk Play Store).
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
}
