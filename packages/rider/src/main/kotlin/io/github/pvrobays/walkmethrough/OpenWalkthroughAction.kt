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

object WalkthroughOpening {
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
                        if (choice is ArtifactEntry) open(choice.path)
                        else FileChooser.chooseFile(FileChooserDescriptor(true, false, false, false, false, false)
                            .withTitle("Choose .walk-me-through/walkthroughs/*.json"), project, null) { file -> open(Path.of(file.path)) }
                    }.createPopup().showCenteredInCurrentWindow(project)
            }
            private fun open(path: Path) {
                object : Task.Backgroundable(project, "Load walkthrough", true) {
                    private var loaded: LoadedArtifact? = null
                    override fun run(indicator: ProgressIndicator) {
                        indicator.checkCanceled(); loaded = ArtifactStore.load(path); indicator.checkCanceled()
                    }
                    override fun onThrowable(error: Throwable) { Messages.showErrorDialog(project, "$path: ${error.message}", "Cannot Open Walkthrough") }
                    override fun onSuccess() {
                        if (project.isDisposed) return
                        val result = loaded ?: return
                        result.warning?.let { Messages.showWarningDialog(project, it, "Walkthrough Project Moved") }
                        project.getService(WalkthroughSession::class.java).open(result.artifact, result.root)
                        ToolWindowManager.getInstance(project).getToolWindow("Walk Me Through")?.show()
                    }
                }.queue()
            }
        }.queue()
    }
}
