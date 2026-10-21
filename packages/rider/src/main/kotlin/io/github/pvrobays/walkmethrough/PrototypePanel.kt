package io.github.pvrobays.walkmethrough

import com.intellij.icons.AllIcons
import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.Disposable
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.ex.RangeHighlighterEx
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorColorsListener
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.EffectType
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.ui.jcef.JBCefApp
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.Color
import java.awt.GridLayout
import javax.swing.JButton
import javax.swing.JPanel

/** Isolated surface experiment: uses current editor selections, not artifact playback. */
class PrototypePanel(private val project: Project) : JBPanel<PrototypePanel>(BorderLayout()), Disposable {
    private val renderer = ExplanationRenderer()
    private val browser = if (JBCefApp.isSupported()) ExplanationBrowser(this) else null
    private val status = JBLabel("Select an expression or multiline range in the editor.")
    private var highlighter: RangeHighlighter? = null
    private var editor: Editor? = null
    private var sample = 0
    private var closed = false
    private var disposed = false

    init {
        border = JBUI.Borders.empty(4)
        val controls = JPanel(GridLayout(0, 2, 4, 4))
        fun button(text: String, mnemonic: Int, tooltip: String, action: () -> Unit) {
            controls.add(JButton(text).apply {
                this.mnemonic = mnemonic
                toolTipText = tooltip
                accessibleContext.accessibleDescription = tooltip
                addActionListener { action() }
            })
        }
        button("Previous", 'P'.code, "Previous prototype sample") { sample = (sample + 2) % 3; render() }
        button("Next", 'N'.code, "Next prototype sample") { sample = (sample + 1) % 3; render() }
        button("Highlight selection", 'H'.code, "Highlight exactly the current editor selection") { capture() }
        button("Return", 'R'.code, "Reveal the owned highlight again") {
            editor?.takeUnless { it.isDisposed }?.let { e ->
                highlighter?.takeIf { it.isValid }?.let { h ->
                    e.virtualFile?.let { FileEditorManager.getInstance(project).openFile(it, true) }
                    e.caretModel.moveToOffset(h.startOffset)
                    e.scrollingModel.scrollToCaret(com.intellij.openapi.editor.ScrollType.CENTER)
                }
            }
        }
        button("Close", 'C'.code, "Clear the prototype explanation and highlight") {
            clearHighlight(); closed = true; render()
        }
        button("Show sample", 'S'.code, "Restore prototype Markdown") { closed = false; render() }
        val header = JPanel(BorderLayout(0, 6)).apply {
            add(controls, BorderLayout.NORTH)
            add(status, BorderLayout.SOUTH)
        }
        add(header, BorderLayout.NORTH)
        add(browser?.component ?: JBLabel(BrowserPolicy.unsupportedMessage()).apply {
            toolTipText = text
        }, BorderLayout.CENTER)
        val connection = project.messageBus.connect(this)
        connection.subscribe(LafManagerListener.TOPIC, LafManagerListener { render() })
        connection.subscribe(EditorColorsManager.TOPIC, EditorColorsListener { render() })
        EditorFactory.getInstance().addEditorFactoryListener(object : com.intellij.openapi.editor.event.EditorFactoryListener {
            override fun editorReleased(event: com.intellij.openapi.editor.event.EditorFactoryEvent) {
                if (event.editor === editor) clearHighlight()
            }
        }, this)
        render()
    }

    private fun capture() {
        val current = FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val selection = current.selectionModel
        if (!selection.hasSelection()) {
            status.text = "Select source text first, then Highlight selection."
            return
        }
        clearHighlight()
        editor = current
        highlighter = current.markupModel.addRangeHighlighter(
            selection.selectionStart, selection.selectionEnd, HighlighterLayer.SELECTION - 1,
            attributes(), HighlighterTargetArea.EXACT_RANGE,
        )
        closed = false
        render()
    }

    private fun attributes(): TextAttributes = TextAttributes().apply {
        backgroundColor = JBColor(Color(225, 238, 255), Color(45, 65, 85))
        effectColor = if (sample == 1) JBColor.ORANGE else JBColor.BLUE
        effectType = if (sample == 1) EffectType.BOLD_DOTTED_LINE else EffectType.BOXED
    }

    private fun render() {
        if (disposed) return
        if (closed || sample == 2) clearHighlight()
        highlighter?.takeIf { it.isValid }?.let { h ->
            (h as RangeHighlighterEx).setTextAttributes(attributes())
        }
        status.icon = when (sample) { 1 -> AllIcons.General.Warning; 2 -> AllIcons.General.Error; else -> AllIcons.General.Information }
        status.foreground = if (sample == 2) JBColor.RED else JBColor.foreground()
        status.text = if (closed) "Prototype closed." else when (sample) {
            1 -> "Uncertain: closest identical code; earlier candidate on ties."
            2 -> "Original code not found — sample.cs:3."
            else -> "Exact selection — expression and multiline prototype."
        }
        val scheme = EditorColorsManager.getInstance().globalScheme
        fun hex(color: Color): String = "#%02x%02x%02x".format(color.red, color.green, color.blue)
        val dark = !JBColor.isBright()
        browser?.show(renderer.document(if (closed) "" else MARKDOWN, ExplanationTheme(
            hex(scheme.defaultBackground), hex(scheme.defaultForeground), hex(JBColor.BLUE),
            if (dark) "#cf8e6d" else "#7a3e00", if (dark) "#a5c48a" else "#276526",
            if (dark) "#a3a3a3" else "#595959", if (dark) "#8bb7e8" else "#164a85",
            JBUI.Fonts.label().size, dark,
        )))
    }

    private fun clearHighlight() {
        highlighter?.dispose()
        highlighter = null
        editor = null
    }

    override fun dispose() { disposed = true; clearHighlight() }

    companion object {
        private val MARKDOWN = """
            ## A persistent explanation

            **Bold evidence**, *italic uncertainty*, and `inline code` remain beside your source while you edit or browse.

            - Select an expression, then **Highlight selection**.
            - Repeat with several lines; only the selected characters should be highlighted.
            - **Next** cycles exact, warning, and red stale samples. Stale clears the highlight.

            ```csharp
            public static int Delay(int attempt) {
                // Syntax coloring is bundled and works offline.
                return Math.Min(1000, attempt * 100);
            }
            ```

            [Open JetBrains documentation externally](https://plugins.jetbrains.com/docs/intellij/)

            ### Read while exploring

            Keep this panel docked on the right. Try a narrow width, scroll, change themes, and use Tab/Shift+Tab or the button mnemonics. Close clears the explanation and owned highlight.

            This is a surface prototype; saved-artifact navigation follows owner acceptance.
        """.trimIndent()
    }
}
