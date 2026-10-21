package io.github.pvrobays.walkmethrough

import org.commonmark.node.Image
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import org.commonmark.renderer.html.HtmlNodeRendererContext
import org.commonmark.renderer.NodeRenderer
import org.commonmark.renderer.html.UrlSanitizer
import java.net.URI
import java.util.Base64
import java.util.UUID

/** Untrusted Markdown is never interpolated into CSS or JavaScript. */
class ExplanationRenderer {
    private val parser = Parser.builder().build()
    private val renderer = HtmlRenderer.builder()
        .escapeHtml(true)
        .sanitizeUrls(true)
        .urlSanitizer(object : UrlSanitizer {
            override fun sanitizeLinkUrl(url: String): String = if (BrowserPolicy.isExternal(url)) url else ""
            override fun sanitizeImageUrl(url: String): String = ""
        })
        .nodeRendererFactory { context -> ImageOmitter(context) }
        .build()

    fun body(markdown: String): String = renderer.render(parser.parse(markdown))

    fun document(markdown: String, theme: ExplanationTheme): String {
        val nonce = UUID.randomUUID().toString()
        val script = javaClass.getResource("/renderer/highlight.min.js")!!.readText()
        val css = """
            :root { color-scheme: ${if (theme.dark) "dark" else "light"}; }
            body { margin: 12px; color: ${theme.foreground}; background: ${theme.background};
                   font: ${theme.fontSize}px system-ui, sans-serif; overflow-wrap: anywhere; }
            pre { overflow-x: auto; padding: 10px; border: 1px solid ${theme.foreground}; border-radius: 4px; }
            code { font-family: ui-monospace, monospace; } a { color: ${theme.link}; }
            .hljs-keyword,.hljs-selector-tag,.hljs-literal { color: ${theme.keyword}; font-weight: bold; }
            .hljs-string,.hljs-regexp,.hljs-attr { color: ${theme.string}; }
            .hljs-comment,.hljs-quote { color: ${theme.comment}; font-style: italic; }
            .hljs-number,.hljs-type,.hljs-title { color: ${theme.number}; }
        """.trimIndent()
        return """<!doctype html><html><head><meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-$nonce'; style-src 'nonce-$nonce'; img-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
            <style nonce="$nonce">$css</style></head><body>${body(markdown)}
            <script nonce="$nonce">$script
            hljs.highlightAll();</script></body></html>""".trimIndent()
    }

    private class ImageOmitter(private val context: HtmlNodeRendererContext) : NodeRenderer {
        override fun getNodeTypes(): Set<Class<out org.commonmark.node.Node>> = setOf(Image::class.java)
        override fun render(node: org.commonmark.node.Node) {
            context.writer.text("[image omitted]")
        }
    }
}

data class ExplanationTheme(
    val background: String, val foreground: String, val link: String,
    val keyword: String, val string: String, val comment: String, val number: String,
    val fontSize: Int, val dark: Boolean,
)

object BrowserPolicy {
    fun isExternal(url: String): Boolean = runCatching {
        val uri = URI(url)
        uri.scheme.lowercase() in setOf("http", "https") && !uri.host.isNullOrBlank() && uri.userInfo == null
    }.getOrDefault(false)

    fun openExternally(url: String, userGesture: Boolean): Boolean = userGesture && isExternal(url)
    fun allowDocument(url: String, currentDocument: String): Boolean = url == currentDocument
    fun dataUrl(html: String): String = "data:text/html;base64," + Base64.getEncoder().encodeToString(html.toByteArray(Charsets.UTF_8))
    fun unsupportedMessage(): String = "Walk Me Through requires Web Browser (JCEF). Enable that bundled plugin and run Rider with its bundled JetBrains Runtime, then reopen this tool window."
}
