package io.github.pvrobays.walkmethrough

import com.intellij.openapi.application.ApplicationManager

object PlaybackEnvironment {
    const val LOCAL_DESKTOP = "Walk Me Through playback requires local desktop Rider on native Windows, Linux or macOS. Open this checkout in local desktop Rider, then use Open Walkthrough there. Remote development hosts, SSH, WSL and headless IDEs are unsupported."

    /** Native Windows, Linux and macOS are all accepted; [os] no longer restricts playback and is kept for callers. */
    @Suppress("UNUSED_PARAMETER")
    fun refusal(os: String, remoteHost: Boolean, headless: Boolean): String? =
        if (remoteHost || headless) LOCAL_DESKTOP else null

    fun currentRefusal(): String? = refusal(System.getProperty("os.name"),
        System.getProperty("idea.platform.prefix", "").contains("RemoteDev", ignoreCase = true) ||
            System.getProperty("intellij.platform.product.mode", "") == "backend" ||
            System.getProperty("remoteDevHost", "false").toBoolean() ||
            !System.getenv("SSH_CONNECTION").isNullOrEmpty() || !System.getenv("WSL_DISTRO_NAME").isNullOrEmpty(),
        ApplicationManager.getApplication().isHeadlessEnvironment)
}
