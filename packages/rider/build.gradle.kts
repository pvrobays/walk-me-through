import java.util.Properties
import org.jetbrains.intellij.platform.gradle.TestFrameworkType

plugins {
    kotlin("jvm") version "2.3.21"
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "io.github.pvrobays.walkmethrough"
version = "0.1.0-prototype"

val localProperties = Properties().apply {
    val file = file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val riderPath = providers.gradleProperty("riderPath")
    .orElse(providers.environmentVariable("RIDER_HOME"))
    .orElse(provider { localProperties.getProperty("riderPath") })

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

dependencies {
    implementation("org.commonmark:commonmark:0.24.0")
    implementation("com.google.code.gson:gson:2.13.2")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito:mockito-core:5.20.0")
    intellijPlatform {
        local(riderPath.get())
        bundledPlugin("com.intellij.modules.jcef")
        testFramework(TestFrameworkType.Platform)
        testFramework(TestFrameworkType.Plugin.Rider)
        pluginVerifier("1.411")
    }
}

kotlin {
    jvmToolchain(25)
}

sourceSets.test { resources.srcDir("../../tests/conformance") }

intellijPlatform {
    pluginVerification { ides { local(riderPath.get()) } }
    pluginConfiguration {
        name = "Walk Me Through"
        ideaVersion {
            sinceBuild = "262.10968.170"
            untilBuild = "262.10968.170"
        }
    }
}

tasks.wrapper {
    gradleVersion = "9.1.0"
    distributionType = Wrapper.DistributionType.BIN
    distributionSha256Sum = "a17ddd85a26b6a7f5ddb71ff8b05fc5104c0202c6e64782429790c933686c806"
}
