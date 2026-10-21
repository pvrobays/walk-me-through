package io.github.pvrobays.walkmethrough

import com.intellij.icons.AllIcons
import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.Disposable
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorColorsListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.treeStructure.Tree
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Component
import java.awt.GridLayout
import javax.swing.JButton
import javax.swing.JPanel
import javax.swing.JSplitPane
import javax.swing.JTree
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeCellRenderer
import javax.swing.tree.DefaultTreeModel
import javax.swing.tree.TreePath

class PlayerPanel(private val project: Project) : JBPanel<PlayerPanel>(BorderLayout()), Disposable {
    private val session = project.getService(WalkthroughSession::class.java)
    private val presenter = StepPresenter(project, session)
    private val renderer = ExplanationRenderer()
    private val browserSupported = JBCefApp.isSupported()
    private var browser: ExplanationBrowser? = null
    private val explanation = JPanel(BorderLayout())
    private val title = JBLabel()
    private val context = JBLabel()
    private val status = JBLabel()
    private val tree = Tree(DefaultMutableTreeNode("No walkthrough"))
    private val buttons = mutableListOf<Pair<JButton, () -> Boolean>>()
    private var updating = false
    private var outlineArtifact: Artifact? = null
    private val nodes = mutableMapOf<String, DefaultMutableTreeNode>()
    private val removeListener: () -> Unit
    internal val outline get() = tree
    internal val explanationStatus get() = status.text
    internal fun control(text: String) = buttons.first { it.first.text == text }.first

    init {
        Disposer.register(this, presenter)
        border = JBUI.Borders.empty(4)
        val toolbar = JPanel(GridLayout(0, 2, 4, 4))
        fun button(text: String, enabled: () -> Boolean = { true }, tooltip: String = text, action: () -> Unit) {
            val b = JButton(text).apply { toolTipText = tooltip; accessibleContext.accessibleDescription = tooltip; mnemonic = text.first().code; addActionListener { action() } }
            buttons.add(b to enabled); toolbar.add(b)
        }
        button("Open") { WalkthroughOpening.choose(project) }
        button("Close", { session.active }) { session.close() }
        button("Previous", { session.hasPrevious }) { session.previous() }
        button("Next", { session.hasNext }) { session.next() }
        button("Skip Details", { session.skipTarget != null }, "Skip nested details and continue to the next available branch.") { session.skipDetails() }
        button("Return", { session.active }) { session.refresh() }
        val header = JPanel(GridLayout(0, 1, 0, 4)).apply { add(title); add(context); add(status) }
        val north = JPanel(BorderLayout(0, 6)).apply { add(toolbar, BorderLayout.NORTH); add(header, BorderLayout.SOUTH) }
        add(north, BorderLayout.NORTH)
        tree.isRootVisible = true
        tree.cellRenderer = object : DefaultTreeCellRenderer() {
            override fun getTreeCellRendererComponent(t: JTree, value: Any, selected: Boolean, expanded: Boolean, leaf: Boolean, row: Int, focus: Boolean): Component {
                super.getTreeCellRendererComponent(t, value, selected, expanded, leaf, row, focus)
                val id = (value as DefaultMutableTreeNode).userObject as? String ?: return this
                val step = session.artifact?.steps?.find { it.id == id }
                text = (if ((session.current?.id ?: "overview") == id && session.active) "▶ " else "") + (step?.title ?: if (id == "overview") "Overview" else id)
                icon = if (step?.id == session.current?.id) stateIcon(session.lastResolution?.state) else if (step?.location != null) AllIcons.FileTypes.Text else AllIcons.General.Information
                return this
            }
        }
        tree.addTreeSelectionListener {
            if (!updating) (tree.lastSelectedPathComponent as? DefaultMutableTreeNode)?.userObject?.let { id -> if (id is String) session.select(id) }
        }
        add(JSplitPane(JSplitPane.VERTICAL_SPLIT, JBScrollPane(tree), explanation).apply { resizeWeight = 0.3 }, BorderLayout.CENTER)
        removeListener = session.listen(::render)
        project.messageBus.connect(this).apply {
            subscribe(LafManagerListener.TOPIC, LafManagerListener { presenter.themeChanged(); render() })
            subscribe(EditorColorsManager.TOPIC, EditorColorsListener { presenter.themeChanged(); render() })
        }
        render()
        if (session.active) session.refresh()
    }

    private fun render() {
        val artifact = session.artifact; val step = session.current; val resolution = session.lastResolution
        if (artifact == null) {
            browser?.let(Disposer::dispose); browser = null
            explanation.removeAll()
            explanation.add(JBScrollPane(JBLabel(if (browserSupported) "Open a saved walkthrough to begin." else "<html>${BrowserPolicy.unsupportedMessage()}</html>")))
        } else if (browser == null) {
            explanation.removeAll()
            if (browserSupported) {
                browser = ExplanationBrowser(this)
                explanation.add(browser!!.component)
            } else explanation.add(JBScrollPane(JBLabel("<html>${BrowserPolicy.unsupportedMessage()}</html>")))
        }
        explanation.revalidate(); explanation.repaint()
        title.text = artifact?.title ?: "No walkthrough open"
        val ancestors = mutableListOf<Step>()
        var parent = step?.parentId
        while (parent != null) { val ancestor = artifact?.steps?.find { it.id == parent } ?: break; ancestors.add(0, ancestor); parent = ancestor.parentId }
        context.text = "<html>" + escape((ancestors.map { it.title } + listOfNotNull(step?.title)).joinToString(" › ") +
            (if (artifact != null) " — ${session.index}/${artifact.steps.size}" else "Choose Open to select a saved walkthrough.")) + "</html>"
        status.text = "<html>" + escape(stateMessage(step, resolution)) + "</html>"
        status.icon = stateIcon(resolution?.state)
        status.foreground = if (resolution?.state == "stale") JBColor.RED else JBColor.foreground()
        buttons.forEach { (button, enabled) -> button.isEnabled = enabled() }
        updating = true
        try {
            if (outlineArtifact !== artifact) {
                nodes.clear()
                val root = DefaultMutableTreeNode(if (artifact == null) "No walkthrough" else "overview")
                nodes["overview"] = root
                artifact?.steps?.forEach { s ->
                    val node = DefaultMutableTreeNode(s.id); nodes[s.id] = node
                    (nodes[s.parentId] ?: root).add(node)
                }
                tree.model = DefaultTreeModel(root); outlineArtifact = artifact
            }
            if (artifact != null) nodes[step?.id ?: "overview"]?.let { node ->
                val path = TreePath(node.path); tree.selectionPath = path
                path.parentPath?.let(tree::expandPath); tree.scrollPathToVisible(path)
            }
            tree.repaint()
        } finally { updating = false }
        val scheme = EditorColorsManager.getInstance().globalScheme
        fun hex(c: Color) = "#%02x%02x%02x".format(c.red, c.green, c.blue)
        val dark = !JBColor.isBright()
        browser?.show(renderer.document(step?.explanation ?: artifact?.summary ?: "Open a saved walkthrough to begin.", ExplanationTheme(
            hex(scheme.defaultBackground), hex(scheme.defaultForeground), hex(JBColor.BLUE),
            if (dark) "#cf8e6d" else "#7a3e00", if (dark) "#a5c48a" else "#276526",
            if (dark) "#a3a3a3" else "#595959", if (dark) "#8bb7e8" else "#164a85", JBUI.Fonts.label().size, dark)))
    }
    override fun dispose() { removeListener() }
}

internal fun escape(text: String) = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
internal fun stateIcon(state: String?) = when (state) { "stale" -> AllIcons.General.Error; "uncertain" -> AllIcons.General.Warning; else -> AllIcons.General.Information }
internal fun stateMessage(step: Step?, resolution: Resolution?): String = when {
    step == null -> "Overview"
    step.location == null -> "Narrative"
    resolution == null -> "Resolving ${step.location.path}…"
    resolution.state == "stale" -> "Original code not found; it may have changed since generation. ${step.location.path}:${step.location.range.start.line + 1} (${resolution.reason})"
    resolution.state == "uncertain" -> "Original location unconfirmed; showing closest identical code." + if (resolution.tie == true) " Equally near candidates: earlier candidate selected." else ""
    resolution.state == "relocated" -> "Identical original context relocated."
    else -> "Exact original context."
}
