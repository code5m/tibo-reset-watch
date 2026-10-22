import SwiftUI
import WidgetKit
import Foundation

// Compile in a Widget Extension target (iOS 17+). No OpenAI/account credentials.
struct ResetSnapshot: Decodable {
    let available: Bool
    let title: String?
    let statusLabel: String?
    let deadlineAt: String?
    let confirmedAt: String?
    let serverTime: String?
    let reason: String?
}
struct ResetEntry: TimelineEntry {
    let date: Date
    let title: String
    let state: String
    let window: String
    let checked: String
}
private func beijing(_ value: String?) -> String {
    guard let value else { return "未知" }
    let format = ISO8601DateFormatter()
    format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = format.date(from: value)
    if date == nil { format.formatOptions = [.withInternetDateTime]; date = format.date(from: value) }
    guard let date else { return "未知" }
    let output = DateFormatter()
    output.locale = Locale(identifier: "zh_CN")
    output.timeZone = TimeZone(identifier: "Asia/Shanghai")
    output.dateFormat = "MM月dd日 HH:mm"
    return output.string(from: date)
}
private func origin() -> URL? {
    guard let raw = Bundle.main.object(forInfoDictionaryKey: "ResetWatchAPIOrigin") as? String,
          let url = URL(string: raw), url.scheme == "https", let host = url.host,
          !host.hasSuffix(".example"), host != "localhost",
          url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
          url.path.isEmpty || url.path == "/" else { return nil }
    return url
}
final class NoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
struct ResetProvider: TimelineProvider {
    func placeholder(in context: Context) -> ResetEntry {
        ResetEntry(date: Date(), title: "ResetWatch", state: "尚未读取",
                   window: "重置最晚时间未知", checked: "非官方服务 · 个人到账未知")
    }
    func getSnapshot(in context: Context, completion: @escaping (ResetEntry) -> Void) {
        if context.isPreview { completion(placeholder(in: context)) }
        else { load(completion) }
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ResetEntry>) -> Void) {
        load { entry in
            // An earliest reload request, not a guaranteed refresh or push-delivery time.
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
        }
    }
    private func load(_ completion: @escaping (ResetEntry) -> Void) {
        func failure(_ text: String) -> ResetEntry {
            ResetEntry(date: Date(), title: "ResetWatch", state: text,
                       window: "重置最晚时间未知", checked: "请打开工作台重新核验")
        }
        guard let root = origin(),
              let url = URL(string: "/api/v1/product?view=widget", relativeTo: root)?.absoluteURL else {
            completion(failure("服务地址未配置")); return
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        let session = URLSession(configuration: configuration, delegate: NoRedirect(), delegateQueue: nil)
        session.dataTask(with: request) { data, response, _ in
            defer { session.finishTasksAndInvalidate() }
            guard let data, data.count <= 32768,
                  (response as? HTTPURLResponse)?.statusCode == 200,
                  let snapshot = try? JSONDecoder().decode(ResetSnapshot.self, from: data) else {
                completion(failure("读取失败，状态未知")); return
            }
            guard snapshot.available else {
                completion(failure(snapshot.reason ?? "没有可核验事件")); return
            }
            let window = snapshot.confirmedAt != nil
                ? "官方确认：北京时间 " + beijing(snapshot.confirmedAt)
                : "参考最晚：北京时间 " + beijing(snapshot.deadlineAt) + "，可能提前"
            completion(ResetEntry(date: Date(), title: String((snapshot.title ?? "ResetWatch").prefix(200)),
                                  state: snapshot.statusLabel ?? "未知", window: window,
                                  checked: "快照：" + beijing(snapshot.serverTime)))
        }.resume()
    }
}
struct ResetWidgetView: View {
    let entry: ResetEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme
    var body: some View {
        VStack(alignment: .leading, spacing: family == .accessoryRectangular ? 3 : 8) {
            Text("ResetWatch").font(.caption.weight(.bold))
            if family != .accessoryRectangular {
                Text(entry.title).font(.headline).lineLimit(2)
            }
            Text(entry.state).font(.subheadline.weight(.semibold)).lineLimit(1)
            Text(entry.window).font(.caption).lineLimit(3)
            if family != .accessoryRectangular {
                Text(entry.checked).font(.caption2).foregroundStyle(.secondary)
                Text("刷新由系统调度 · 个人到账未知").font(.caption2).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .containerBackground(for: .widget) {
            colorScheme == .dark ? Color(red: 0.08, green: 0.18, blue: 0.15) : Color(red: 0.90, green: 0.95, blue: 0.92)
        }
        .widgetURL(origin()?.appendingPathComponent("workbench"))
    }
}
@main
struct ResetWatchWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ResetWatchPublicStatus", provider: ResetProvider()) { entry in
            ResetWidgetView(entry: entry)
        }
        .configurationDisplayName("ResetWatch 额度消息")
        .description("公开原帖状态与北京时间参考截止，不读取个人额度。")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
