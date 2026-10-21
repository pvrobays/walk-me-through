package io.github.pvrobays.walkmethrough

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.fileChooser.FileChooser
import com.intellij.openapi.fileChooser.FileChooserDescriptor
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.Task
import com.intellij.openapi.roots.ProjectRootManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.project.Project
import java.nio.file.Path

class OpenWalkthroughAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) { e.presentation.isEnabled = e.project != null }
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        WalkthroughOpening.choose(project)
    }
}

/** How an open reports problems: dialogs for the explicit picker, notifications for launch links. */
interface OpenFeedback {
    fun error(message: String)
    fun warning(message: String)
    fun stepMissing(stepId: String)
}

object WalkthroughOpening {
    const val TOOL_WINDOW_ID = "Walk Me Through"

    /** Picker feedback keeps the original modal dialogs and wording. */
    fun dialogs(project: Project, path: Path) = object : OpenFeedback {
        override fun error(message: String) = Messages.showErrorDialog(project, "$path: $message", "Cannot Open Walkthrough")
        override fun warning(message: String) = Messages.showWarningDialog(project, message, "Walkthrough Project Moved")
        override fun stepMissing(stepId: String) {}
    }

    /** Validates on a background thread; a mismatching ID or invalid file never replaces the session. */
    fun load(path: Path, expectedId: String? = null): LoadedArtifact {
        val loaded = ArtifactStore.load(path)
        require(expectedId == null || loaded.artifact.id == expectedId) {
            "$path: id: expected walkthrough ID $expectedId, but the file contains ${loaded.artifact.id}."
        }
        return loaded
    }

    /** EDT part of every open: replace the session, select the requested step, and reveal the player. Returns false for an unknown step. */
    fun apply(project: Project, loaded: LoadedArtifact, stepId: String?): Boolean {
        val session = project.getService(WalkthroughSession::class.java)
        session.open(loaded.artifact, loaded.root)
        val found = stepId == null || stepId == "overview" || loaded.artifact.steps.any { it.id == stepId }
        if (stepId != null && found) session.select(stepId)
        ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID)?.show()
        return found
    }

    /** The single open entry point shared by the picker and launch links. */
    fun open(project: Project, path: Path, stepId: String? = null, expectedId: String? = null, feedback: OpenFeedback = dialogs(project, path)) {
        object : Task.Backgroundable(project, "Load walkthrough", true) {
            private var loaded: LoadedArtifact? = null
            override fun run(indicator: ProgressIndicator) {
                indicator.checkCanceled(); loaded = load(path, expectedId); indicator.checkCanceled()
            }
            override fun onThrowable(error: Throwable) { feedback.error(error.message ?: error.toString()) }
            override fun onSuccess() {
                if (project.isDisposed) return
                val result = loaded ?: return
                result.warning?.let(feedback::warning)
                if (!apply(project, result, stepId)) feedback.stepMissing(stepId!!)
            }
        }.queue()
    }

    fun choose(project: Project) {
        PlaybackEnvironment.currentRefusal()?.let { Messages.showErrorDialog(project, it, "Unsupported Playback Environment"); return }
        val roots = (listOfNotNull(project.basePath) + ProjectRootManager.getInstance(project).contentRoots.map { it.path }).distinct().map(Path::of)
        object : Task.Backgroundable(project, "Find saved walkthroughs", true) {
            private var entries = emptyList<ArtifactEntry>()
            override fun run(indicator: ProgressIndicator) { entries = ArtifactStore.discover(roots) { indicator.checkCanceled() } }
            override fun onSuccess() {
                if (project.isDisposed) return
                val browse = if (entries.isEmpty()) "Browse… (publish a walkthrough or select a saved artifact)" else "Browse…"
                val choices: List<Any> = entries + browse
                JBPopupFactory.getInstance().createPopupChooserBuilder(choices)
                    .setTitle("Open Walkthrough — select title / ID")
                    .setItemChosenCallback { choice ->
                        if (choice is ArtifactEntry) open(project, choice.path)
                        else FileChooser.chooseFile(FileChooserDescriptor(true, false, false, false, false, false)
                            .withTitle("Choose .walk-me-through/walkthroughs/*.json"), project, null) { file -> open(project, Path.of(file.path)) }
                    }.createPopup().showCenteredInCurrentWindow(project)
            }
        }.queue()
    }
}
