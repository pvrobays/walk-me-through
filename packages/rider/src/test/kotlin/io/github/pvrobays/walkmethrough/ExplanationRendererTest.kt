package io.github.pvrobays.walkmethrough

import org.junit.Assert.*
import org.junit.Test

class ExplanationRendererTest {
    private val renderer = ExplanationRenderer()

    @Test fun `raw HTML and script are escaped while Markdown renders`() {
        val body = renderer.body("**bold** *italic* `code`\n\n<script>alert(1)</script>\n\n<iframe src='https://example.com'></iframe>")
        assertTrue(body.contains("<strong>bold</strong>"))
        assertTrue(body.contains("<em>italic</em>"))
        assertTrue(body.contains("<code>code</code>"))
        assertFalse(body.contains("<script>"))
        assertFalse(body.contains("<iframe"))
        assertTrue(body.contains("&lt;script&gt;"))
    }

    @Test fun `unsafe URLs and embedded images cannot become resources`() {
        for (url in listOf("command:run", "file:///C:/secret", "custom:thing", "javascript:alert(1)", "data:text/html,test", "//example.com/a")) {
            assertFalse(url, BrowserPolicy.isExternal(url))
            assertFalse(renderer.body("[unsafe]($url)").contains("href=\"$url\""))
        }
        val image = renderer.body("![remote](https://example.com/tracker.png)")
        assertFalse(image.contains("<img"))
        assertFalse(image.contains("tracker.png"))
    }

    @Test fun `only user activated HTTP links open externally and all other resources cancel`() {
        assertTrue(BrowserPolicy.openExternally("https://example.com/docs", true))
        assertTrue(BrowserPolicy.openExternally("http://example.com/", true))
        assertFalse(BrowserPolicy.openExternally("https://example.com/", false))
        assertFalse(BrowserPolicy.openExternally("file:///C:/secret", true))
        assertFalse(BrowserPolicy.allowDocument("https://example.com/tracker", "data:text/html;base64,test"))
        assertTrue(BrowserPolicy.allowDocument("document", "document"))
    }

    @Test fun `document packages highlighting with strict CSP and no external resource tags`() {
        val html = renderer.document("```csharp\nreturn 42;\n```", ExplanationTheme(
            "#ffffff", "#000000", "#0000ff", "#880000", "#008800", "#555555", "#000088", 13, false,
        ))
        assertTrue(html.contains("language-csharp"))
        assertTrue(html.contains("hljs.highlightAll()"))
        assertTrue(html.contains("default-src 'none'"))
        assertTrue(html.contains("img-src 'none'"))
        assertFalse(html.contains("<script src="))
        assertFalse(html.contains("<link "))
        assertTrue(BrowserPolicy.unsupportedMessage().contains("bundled JetBrains Runtime"))
    }
}
