package io.github.pvrobays.walkmethrough

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

class WalkthroughToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = PlayerPanel(project)
        val content = ContentFactory.getInstance().createContent(panel, "Walkthrough", false)
        content.setDisposer(panel)
        toolWindow.contentManager.addContent(content)
    }
}
