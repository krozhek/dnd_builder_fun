import UIKit
import WebKit
import PDFKit

final class A4Renderer: UIPrintPageRenderer {
    override var paperRect: CGRect { CGRect(x: 0, y: 0, width: 595.28, height: 841.89) }
    override var printableRect: CGRect { paperRect }
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "PDF check", sessionRole: session.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate, WKNavigationDelegate {
    var window: UIWindow?
    var webView: WKWebView!

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        let webView = WKWebView(frame: window.bounds)
        self.window = window
        self.webView = webView
        webView.navigationDelegate = self
        window.rootViewController = UIViewController()
        window.rootViewController?.view = webView
        window.makeKeyAndVisible()
        let html = Bundle.main.url(forResource: "dnd_builder", withExtension: "html")!
        webView.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("C=newChar();C.name='iOS PDF Check';SHEET_VERSION='2014';TAB='sheet';render()") { _, error in
            if let error { self.finish("error: \(error.localizedDescription)"); return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.exportPDF() }
        }
    }

    private func exportPDF() {
        let renderer = A4Renderer()
        renderer.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)
        let pages = renderer.numberOfPages
        guard pages >= 4 else { finish("error: expected at least four sheet pages, got \(pages)"); return }
        renderer.prepare(forDrawingPages: NSRange(location: 0, length: pages))
        let output = NSMutableData()
        UIGraphicsBeginPDFContextToData(output, renderer.paperRect, nil)
        for page in 0..<pages {
            UIGraphicsBeginPDFPage()
            renderer.drawPage(at: page, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()
        let data = output as Data
        guard let document = PDFDocument(data: data), document.pageCount >= 4 else {
            finish("error: WebKit did not produce a readable multi-page PDF")
            return
        }
        let pageTexts = (0..<document.pageCount).compactMap { document.page(at: $0)?.string }
        let sheetText = pageTexts.prefix(4).joined(separator: "\n")
        let contentPages = pageTexts.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.count
        guard contentPages == 4, sheetText.contains("iOS PDF Check"), sheetText.localizedCaseInsensitiveContains("заговоры") else {
            finish("error: PDF is missing one of the four sheet pages or its content")
            return
        }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        do {
            try data.write(to: documents.appendingPathComponent("sheet.pdf"))
            try "status=ok\nbytes=\(data.count)\npages=\(document.pageCount)\nsheet_pages=\(contentPages)\n".write(to: documents.appendingPathComponent("result.txt"), atomically: true, encoding: .utf8)
            finish("ok")
        } catch { finish("error: \(error.localizedDescription)") }
    }

    private func finish(_ result: String) {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        if result != "ok" {
            try? result.write(to: documents.appendingPathComponent("result.txt"), atomically: true, encoding: .utf8)
        }
        NSLog("IOS_PDF_RESULT: %@", result)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { exit(result == "ok" ? 0 : 1) }
    }
}
