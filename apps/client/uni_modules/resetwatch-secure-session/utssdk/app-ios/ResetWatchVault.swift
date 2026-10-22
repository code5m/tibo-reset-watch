import Foundation
import Security
import CryptoKit

/// App-access-group Keychain. Device-only, non-synchronizing, available while unlocked.
public final class ResetWatchVault {
    private static let queue = DispatchQueue(label: "resetwatch.secure-session.v1")
    private static let service = "ResetWatch.secure-session.v1"

    public static func invoke(_ operation: String, _ origin: String, _ value: String,
                              _ callback: @escaping (String) -> Void) {
        queue.async {
            let result = perform(operation, origin, value)
            DispatchQueue.main.async { callback(result) }
        }
    }

    // Same implementation is compiled against iOS SDK and exercised by macOS Keychain CI.
    public static func perform(_ operation: String, _ origin: String, _ value: String) -> String {
        guard origin.range(of: "^https://[a-z0-9.-]+(?::[0-9]{1,5})?$", options: .regularExpression) != nil,
              origin.utf8.count <= 280 else { return failure("invalid_origin") }
        let account = SHA256.hash(data: Data(origin.utf8)).map { String(format: "%02x", $0) }.joined()
        var query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false]
        if operation == "remove" {
            let status = SecItemDelete(query as CFDictionary)
            return status == errSecSuccess || status == errSecItemNotFound ? success("") : failure(code(status))
        }
        if operation == "read" {
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)
            if status == errSecItemNotFound { return success("") }
            guard status == errSecSuccess else { return failure(code(status)) }
            guard let data = item as? Data, data.count <= 256,
                  let token = String(data: data, encoding: .utf8), valid(token) else { return failure("unreadable") }
            return success(token)
        }
        guard operation == "write", valid(value) else { return failure("invalid_token") }
        let attributes: [String: Any] = [kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        // Update first: never delete a working item merely to attempt a replacement.
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            query.merge(attributes) { _, new in new }
            status = SecItemAdd(query as CFDictionary, nil)
        }
        return status == errSecSuccess ? success("") : failure(code(status))
    }
    private static func valid(_ value: String) -> Bool {
        value.range(of: "^rw_[a-f0-9]{64}$", options: .regularExpression) != nil
    }
    private static func code(_ status: OSStatus) -> String {
        status == errSecInteractionNotAllowed || status == errSecNotAvailable ? "locked" : "unreadable"
    }
    private static func success(_ value: String) -> String { json(["ok": true, "value": value]) }
    private static func failure(_ code: String) -> String { json(["ok": false, "code": code]) }
    private static func json(_ data: [String: Any]) -> String {
        guard let encoded = try? JSONSerialization.data(withJSONObject: data),
              let text = String(data: encoded, encoding: .utf8) else { return "{\"ok\":false,\"code\":\"unreadable\"}" }
        return text
    }
}
