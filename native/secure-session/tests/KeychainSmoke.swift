import Foundation

@main struct KeychainSmoke {
    static func main() throws {
        let origin = "https://resetwatch-ci-" + UUID().uuidString.lowercased() + ".invalid"
        let other = origin.replacingOccurrences(of: "https://", with: "https://other-")
        let token = "rw_" + String(repeating: "a", count: 64)
        let replacement = "rw_" + String(repeating: "b", count: 64)
        defer { _ = ResetWatchVault.perform("remove", origin, "") }
        func run(_ op: String, _ key: String, _ value: String = "") throws -> [String: Any] {
            let raw = ResetWatchVault.perform(op, key, value)
            return try JSONSerialization.jsonObject(with: Data(raw.utf8)) as! [String: Any]
        }
        func check(_ condition: Bool, _ name: String) {
            guard condition else { fatalError("Keychain check failed: " + name) }
            print("PASS " + name)
        }
        let empty = try run("read", origin)
        check(empty["value"] as? String == "", "empty namespace")
        check(try run("write", origin, token)["ok"] as? Bool == true, "write")
        check(try run("read", origin)["value"] as? String == token, "read")
        check(try run("read", other)["value"] as? String == "", "origin isolation")
        check(try run("write", origin, replacement)["ok"] as? Bool == true, "replace")
        check(try run("read", origin)["value"] as? String == replacement, "read replacement")
        check(try run("write", origin, "bad")["ok"] as? Bool == false, "reject malformed token")
        check(try run("remove", origin)["ok"] as? Bool == true, "delete")
        check(try run("read", origin)["value"] as? String == "", "absent after delete")
        print("9 macOS Keychain checks passed; iOS device behavior is NOT asserted.")
    }
}
