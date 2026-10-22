import java.util.Properties
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.models.ProductRelease

plugins {
    kotlin("jvm") version "2.3.21"
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "io.github.pvrobays.walkmethrough"
version = "0.2.0"

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

// Ship the canonical skill bundle (built by `npm run build`) inside the plugin jar for Install Skill into Project.
val skillFiles = listOf("SKILL.md", "manifest.json", "references/walkthrough-format.md", "scripts/publish-walkthrough.mjs")
tasks.processResources {
    from("../skill") {
        include(skillFiles)
        into("skill")
    }
    inputs.files(skillFiles.map { "../skill/$it" })
}

intellijPlatform {
    // The installed Rider plus the newest released Rider from build 262 on (downloaded and cached by Gradle, several GB).
    pluginVerification {
        ides {
            local(riderPath.get())
            select {
                types = listOf(IntelliJPlatformType.Rider)
                channels = listOf(ProductRelease.Channel.RELEASE)
                sinceBuild = "262"
            }
        }
    }
    pluginConfiguration {
        name = "Walk Me Through"
        version = project.version.toString()
        description = providers.fileContents(layout.projectDirectory.file("marketplace/description.html")).asText
        changeNotes = providers.fileContents(layout.projectDirectory.file("marketplace/change-notes.html")).asText
        vendor {
            name = "pvrobays"
            url = "https://github.com/pvrobays"
        }
        ideaVersion {
            sinceBuild = "262"
            untilBuild = provider { null }
        }
    }
}

// Optional author signing. Supply the PEM contents through the environment (CERTIFICATE_CHAIN, PRIVATE_KEY,
// PRIVATE_KEY_PASSWORD) or Gradle properties (certificateChain, privateKey, privateKeyPassword); never commit them.
// Without all three, signPlugin and verifyPluginSignature are skipped and buildPlugin produces the unsigned ZIP.
fun secret(variable: String, property: String) = providers.environmentVariable(variable).orElse(providers.gradleProperty(property))
val signingChain = secret("CERTIFICATE_CHAIN", "certificateChain")
val signingKey = secret("PRIVATE_KEY", "privateKey")
val signingPassword = secret("PRIVATE_KEY_PASSWORD", "privateKeyPassword")
val signingConfigured = signingChain.isPresent && signingKey.isPresent && signingPassword.isPresent
intellijPlatform {
    signing {
        certificateChain = signingChain
        privateKey = signingKey
        password = signingPassword
    }
}
tasks.signPlugin { onlyIf("signing material is configured") { signingConfigured } }
tasks.verifyPluginSignature {
    dependsOn(tasks.signPlugin) // It checks the signed ZIP that signPlugin writes.
    onlyIf("signing material is configured") { signingConfigured }
}

// LICENSE and the third-party notices sit at the plugin root inside the ZIP.
tasks.prepareSandbox {
    from(layout.projectDirectory.file("../../LICENSE")) { into(pluginName) }
    from(layout.projectDirectory.file("THIRD-PARTY-NOTICES.txt")) { into(pluginName) }
}

// NoticesTest compares THIRD-PARTY-NOTICES.txt with the jars the production sandbox bundles in lib/.
tasks.test {
    dependsOn(tasks.prepareSandbox)
    val pluginDirectory = tasks.prepareSandbox.flatMap { it.pluginDirectory }.map { it.asFile.absolutePath }
    jvmArgumentProviders.add(CommandLineArgumentProvider { listOf("-Dwmt.pluginDirectory=${pluginDirectory.get()}") })
}

tasks.wrapper {
    gradleVersion = "9.1.0"
    distributionType = Wrapper.DistributionType.BIN
    distributionSha256Sum = "a17ddd85a26b6a7f5ddb71ff8b05fc5104c0202c6e64782429790c933686c806"
}
