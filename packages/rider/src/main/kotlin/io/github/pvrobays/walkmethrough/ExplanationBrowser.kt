package io.github.pvrobays.walkmethrough

import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefContextMenuHandlerAdapter
import org.cef.handler.CefLifeSpanHandlerAdapter
import org.cef.handler.CefRequestHandlerAdapter
import org.cef.handler.CefResourceRequestHandlerAdapter
import org.cef.handler.CefResourceRequestHandler
import org.cef.callback.CefContextMenuParams
import org.cef.callback.CefMenuModel
import org.cef.misc.BoolRef
import org.cef.network.CefRequest
import javax.swing.JComponent

class ExplanationBrowser(parent: Disposable) : Disposable {
    private val browser = JBCefBrowser()
    @Volatile private var currentDocument = ""
    val component: JComponent get() = browser.component

    init {
        Disposer.register(parent, this)
        Disposer.register(this, browser)
        val client = browser.jbCefClient.cefClient
        client.addRequestHandler(ExplanationRequestHandler({ currentDocument }) { url ->
            ApplicationManager.getApplication().invokeLater { BrowserUtil.browse(url) }
        })
        client.addLifeSpanHandler(ExplanationPopupHandler())
        client.addContextMenuHandler(object : CefContextMenuHandlerAdapter() {
            override fun onBeforeContextMenu(b: CefBrowser, frame: CefFrame, params: CefContextMenuParams, model: CefMenuModel) {
                model.clear()
            }
        })
    }

    fun show(html: String) {
        currentDocument = BrowserPolicy.dataUrl(html)
        browser.loadURL(currentDocument)
    }
    override fun dispose() {}
}

internal class ExplanationRequestHandler(
    private val document: () -> String,
    private val openExternal: (String) -> Unit,
) : CefRequestHandlerAdapter() {
            override fun onBeforeBrowse(b: CefBrowser, frame: CefFrame, request: CefRequest, gesture: Boolean, redirect: Boolean): Boolean {
                if (BrowserPolicy.allowDocument(request.url, document())) return false
                if (BrowserPolicy.openExternally(request.url, gesture)) {
                    openExternal(request.url)
                }
                return true
            }

            override fun onOpenURLFromTab(b: CefBrowser, frame: CefFrame, url: String, gesture: Boolean): Boolean {
                if (BrowserPolicy.openExternally(url, gesture)) {
                    openExternal(url)
                }
                return true
            }

            override fun getResourceRequestHandler(b: CefBrowser, frame: CefFrame, request: CefRequest, navigation: Boolean, download: Boolean, initiator: String, disable: BoolRef): CefResourceRequestHandler {
                return object : CefResourceRequestHandlerAdapter() {
                    override fun onBeforeResourceLoad(b: CefBrowser, frame: CefFrame, request: CefRequest): Boolean =
                        !BrowserPolicy.allowDocument(request.url, document())
                }
            }
}

internal class ExplanationPopupHandler : CefLifeSpanHandlerAdapter() {
    override fun onBeforePopup(b: CefBrowser, frame: CefFrame, url: String, name: String): Boolean = true
}
