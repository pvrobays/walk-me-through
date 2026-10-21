package io.github.pvrobays.walkmethrough

import com.intellij.openapi.application.ApplicationManager

object PlaybackEnvironment {
    fun refusal(os: String, remoteHost: Boolean, headless: Boolean): String? = when {
        remoteHost || headless -> "Walk Me Through playback requires local desktop Rider. Open this checkout in native Windows Rider, then use Open Walkthrough there. Remote development hosts are unsupported."
        !os.startsWith("Windows", ignoreCase = true) -> "This development plugin is accepted only on native Windows Rider 2026.2.3.1. Open the saved artifact in that local desktop environment."
        else -> null
    }
    fun currentRefusal(): String? = refusal(System.getProperty("os.name"),
        System.getProperty("idea.platform.prefix", "").contains("RemoteDev", ignoreCase = true) ||
            System.getProperty("intellij.platform.product.mode", "") == "backend" ||
            System.getProperty("remoteDevHost", "false").toBoolean() ||
            !System.getenv("SSH_CONNECTION").isNullOrEmpty() || !System.getenv("WSL_DISTRO_NAME").isNullOrEmpty(),
        ApplicationManager.getApplication().isHeadlessEnvironment)
}
