package io.github.pvrobays.walkmethrough

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ActionUpdateThread

abstract class NavigationAction(private val operation: String) : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) {
        val s = e.project?.getService(WalkthroughSession::class.java)
        e.presentation.isEnabled = s != null && when (operation) {
            "next" -> s.hasNext; "previous" -> s.hasPrevious; "skip" -> s.skipTarget != null; else -> s.active
        }
    }
    override fun actionPerformed(e: AnActionEvent) {
        val s = e.project?.getService(WalkthroughSession::class.java) ?: return
        when (operation) {
            "next" -> s.next(); "previous" -> s.previous(); "skip" -> s.skipDetails(); "return" -> s.refresh(); "close" -> s.close()
        }
    }
}
class NextWalkthroughAction : NavigationAction("next")
class PreviousWalkthroughAction : NavigationAction("previous")
class SkipDetailsAction : NavigationAction("skip")
class ReturnToStepAction : NavigationAction("return")
class CloseWalkthroughAction : NavigationAction("close")
