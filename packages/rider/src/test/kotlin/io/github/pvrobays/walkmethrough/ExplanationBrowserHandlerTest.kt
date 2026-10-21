package io.github.pvrobays.walkmethrough

import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.misc.BoolRef
import org.cef.network.CefRequest
import org.junit.Assert.*
import org.junit.Test
import org.mockito.Mockito.*

class ExplanationBrowserHandlerTest {
    private val browser = mock(CefBrowser::class.java)
    private val frame = mock(CefFrame::class.java)
    private val opened = mutableListOf<String>()
    private val document = BrowserPolicy.dataUrl("<p>local document</p>")
    private val handler = ExplanationRequestHandler({ document }, opened::add)

    private fun request(url: String): CefRequest = mock(CefRequest::class.java).also {
        `when`(it.url).thenReturn(url)
    }

    @Test fun `handler allows only current document and externally opens gesture HTTP links`() {
        assertFalse(handler.onBeforeBrowse(browser, frame, request(document), false, false))
        for (url in listOf("https://example.com", "http://example.com")) {
            assertTrue(handler.onBeforeBrowse(browser, frame, request(url), false, false))
            assertTrue(opened.isEmpty())
        }
        assertTrue(handler.onBeforeBrowse(browser, frame, request("https://example.com"), true, false))
        assertEquals(listOf("https://example.com"), opened)
    }

    @Test fun `handlers reject local command custom resources and popups`() {
        val popup = ExplanationPopupHandler()
        for (url in listOf("command:run", "file:///C:/secret", "custom:thing", "https://example.com/tracker", "data:text/html,other")) {
            val request = request(url)
            val resource = handler.getResourceRequestHandler(browser, frame, request, false, false, "", BoolRef(false))
            assertTrue(url, resource.onBeforeResourceLoad(browser, frame, request))
            assertTrue(url, popup.onBeforePopup(browser, frame, url, "popup"))
        }
        for (url in listOf("command:run", "file:///C:/secret", "custom:thing")) {
            assertTrue(handler.onBeforeBrowse(browser, frame, request(url), true, false))
            assertTrue(handler.onOpenURLFromTab(browser, frame, url, true))
        }
        assertTrue(opened.isEmpty())
        assertTrue(handler.onOpenURLFromTab(browser, frame, "https://example.com", true))
        assertEquals(listOf("https://example.com"), opened)
    }
}
