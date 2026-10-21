package io.github.pvrobays.walkmethrough

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.JBProtocolCommand
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.roots.ProjectRootManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.util.Computable
import com.intellij.openapi.wm.IdeFocusManager
import com.intellij.openapi.wm.WindowManager
import java.nio.file.Files
import java.nio.file.Path

/**
 * Handles `jetbrains://rider/walkmethrough/open?e=<envelope>`, delivered by jetbrainsd/Toolbox.
 * Plays only in an already-open project containing the recorded checkout; it never opens a project.
 * The platform already logs the full URI, so the envelope is not logged again here.
 */
class LaunchProtocolCommand : JBProtocolCommand(COMMAND) {
    override suspend fun execute(target: String?, parameters: Map<String, String>, fragment: String?): String? {
        ApplicationManager.getApplication().invokeLater {
            LaunchHandling.handle(target, parameters, PlaybackEnvironment.currentRefusal(), System.getProperty("os.name"), NotificationFeedback)
        }
        return null
    }

    companion object {
        const val COMMAND = "walkmethrough"
        const val NOTIFICATION_GROUP = "Walk Me Through"
    }
}

/** Where launch notices go: the chosen project when there is one, otherwise the application. */
interface LaunchFeedback { fun notify(project: Project?, type: NotificationType, message: String) }

object NotificationFeedback : LaunchFeedback {
    override fun notify(project: Project?, type: NotificationType, message: String) {
        val app = ApplicationManager.getApplication()
        if (project == null && !app.isUnitTestMode && !app.isHeadlessEnvironment && WindowManager.getInstance().findVisibleFrame() == null) {
            // No frame can show a balloon (for example while Rider is still starting); fall back to a modal message.
            if (type == NotificationType.ERROR) Messages.showErrorDialog(message, "Walk Me Through") else Messages.showWarningDialog(message, "Walk Me Through")
            return
        }
        NotificationGroupManager.getInstance().getNotificationGroup(LaunchProtocolCommand.NOTIFICATION_GROUP)
            .createNotification("Walk Me Through", message, type).notify(project)
    }
}

data class LaunchResult(val kind: String, val message: String? = null, val project: Project? = null)

object LaunchHandling {
    private const val FRESH = "Ask your coding agent for a fresh walkthrough link, or use Walk Me Through: Open Walkthrough."

    /** Node-style platform names, as recorded in artifacts and envelopes. */
    fun platformOf(os: String): String = when {
        os.startsWith("Windows", ignoreCase = true) -> "win32"
        os.startsWith("Mac", ignoreCase = true) -> "darwin"
        os.startsWith("Linux", ignoreCase = true) -> "linux"
        else -> os.lowercase()
    }

    /** Canonical comparison key: real path, separators normalized, case-folded on Windows; null if it does not exist. */
    fun canonical(value: String, windows: Boolean): String? {
        val real = try { Path.of(value).toRealPath().toString() } catch (_: Exception) { return null }
        val normalized = if (windows) real.replace('/', '\\').lowercase() else real
        return normalized.trimEnd('\\', '/').ifEmpty { normalized }
    }

    fun contains(folder: String, root: String, windows: Boolean): Boolean {
        if (folder == root) return true
        val separator = if (windows) '\\' else '/'
        return root.startsWith(if (folder.endsWith(separator)) folder else folder + separator)
    }

    fun projectRoots(project: Project): List<String> = ApplicationManager.getApplication().runReadAction(Computable {
        (listOfNotNull(project.basePath) + ProjectRootManager.getInstance(project).contentRoots.map { it.path }).distinct()
    })

    /** Last-focused matching project, else the most recently opened matching project. */
    fun choose(root: String, projects: List<Project>, focused: Project?, windows: Boolean, roots: (Project) -> List<String> = ::projectRoots): Project? {
        val candidates = projects.filter { project ->
            !project.isDisposed && roots(project).mapNotNull { canonical(it, windows) }.any { contains(it, root, windows) }
        }
        return candidates.firstOrNull { it == focused } ?: candidates.lastOrNull()
    }

    fun lastFocusedProject(): Project? = IdeFocusManager.getGlobalInstance().lastFocusedFrame?.project

    /** Runs on the EDT. Validation problems are reported immediately; loading continues in the background. */
    fun handle(target: String?, parameters: Map<String, String>, refusal: String?, os: String, feedback: LaunchFeedback,
               projects: List<Project> = ProjectManager.getInstance().openProjects.toList(), focused: Project? = lastFocusedProject()): LaunchResult {
        fun refuse(kind: String, message: String, project: Project? = null, type: NotificationType = NotificationType.ERROR): LaunchResult {
            feedback.notify(project, type, message)
            return LaunchResult(kind, message, project)
        }
        if (target != "open") return refuse("invalid-link", "This Walk Me Through link is not valid: unknown target \"$target\". $FRESH")
        val encoded = parameters["e"]
        if (encoded.isNullOrEmpty()) return refuse("invalid-link", "This Walk Me Through link is not valid: it has no launch data. $FRESH")
        val decoded = LaunchEnvelopes.decode(encoded)
        val envelope = decoded.envelope ?: return if (decoded.category == "unsupported-version")
            refuse("newer-version", "This walkthrough link was produced by a newer Walk Me Through version. Update the Walk Me Through plugin, then open the link again.")
        else refuse("invalid-link", "This Walk Me Through link is not valid (${decoded.problems[0].path}: ${decoded.problems[0].message}) $FRESH")
        refusal?.let { return refuse("environment", it) }
        val platform = platformOf(os)
        if (envelope.kind != "local" || envelope.platform != platform) {
            return refuse("environment", "This walkthrough was published in a ${envelope.kind} ${envelope.platform} environment, but this is local desktop Rider on $platform. Open it in local desktop Rider on the platform that published it.")
        }
        val windows = platform == "win32"
        val root = canonical(envelope.root, windows)
        val project = root?.let { choose(it, projects, focused, windows) }
            ?: return refuse("no-match", "This walkthrough belongs to ${envelope.root}, which is not open in Rider. Open that project in Rider, then open the link again.", type = NotificationType.WARNING)
        // Only the identified artifact in the recorded checkout's walkthrough directory is ever read.
        val file = Path.of(envelope.root).toRealPath().resolve(".walk-me-through").resolve("walkthroughs").resolve("${envelope.id}.json")
        if (!Files.isRegularFile(file)) return refuse("artifact-removed", "The saved walkthrough ${envelope.id} was removed. Expected $file. $FRESH", project)
        WalkthroughOpening.open(project, file, envelope.step, envelope.id, object : OpenFeedback {
            override fun error(message: String) = feedback.notify(project, NotificationType.ERROR, "Cannot open walkthrough: $message")
            override fun warning(message: String) = feedback.notify(project, NotificationType.WARNING, message)
            override fun stepMissing(stepId: String) =
                feedback.notify(project, NotificationType.INFORMATION, "Step \"$stepId\" was not found in this walkthrough, so it opened at the overview.")
        })
        return LaunchResult("scheduled", project = project)
    }
}
