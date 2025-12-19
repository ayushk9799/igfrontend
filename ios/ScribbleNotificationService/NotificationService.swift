//
//  NotificationService.swift
//  ScribbleNotificationService
//
//  Notification Service Extension to process scribble notifications
//  and update widget when app is killed
//

import UserNotifications
import WidgetKit

class NotificationService: UNNotificationServiceExtension {
    
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    
    private let appGroupIdentifier = "group.com.thousandways.love"
    private let widgetKind = "ScribbleWidget"  // Must match Widget's kind
    
    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }
        
        let userInfo = request.content.userInfo
        
        // Extract data - FCM puts data fields at ROOT level of userInfo
        let type = userInfo["type"] as? String
        let pathsString = userInfo["paths"] as? String
        let senderName = userInfo["senderName"] as? String
        let timestamp = userInfo["timestamp"] as? String ?? ISO8601DateFormatter().string(from: Date())
        
        if type == "scribble", let pathsString = pathsString, let senderName = senderName {
            // Parse paths JSON
            if let pathsData = pathsString.data(using: .utf8),
               let paths = try? JSONSerialization.jsonObject(with: pathsData) as? [[String: Any]] {
                
                // Save to App Group with a unique version to bust cache
                let saved = saveScribbleToAppGroup(paths: paths, senderName: senderName, timestamp: timestamp)
                
                if saved {
                    bestAttemptContent.subtitle = "✅ \(paths.count) paths saved"
                    
                    // Trigger widget refresh using SPECIFIC kind
                    if #available(iOS 14.0, *) {
                        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
                    }
                } else {
                    bestAttemptContent.subtitle = "❌ Save failed"
                }
            } else {
                bestAttemptContent.subtitle = "❌ JSON parse failed"
            }
        } else {
            bestAttemptContent.subtitle = "type=\(type ?? "nil")"
        }
        
        contentHandler(bestAttemptContent)
    }
    
    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
    
    private func saveScribbleToAppGroup(paths: [[String: Any]], senderName: String, timestamp: String) -> Bool {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            return false
        }
        
        do {
            // Add a unique version number to ensure widget sees this as new data
            let version = Int(Date().timeIntervalSince1970 * 1000)
            
            let scribbleData: [String: Any] = [
                "paths": paths,
                "senderName": senderName,
                "timestamp": timestamp,
                "savedAt": ISO8601DateFormatter().string(from: Date()),
                "version": version  // Unique version to bust cache
            ]
            
            let jsonURL = containerURL.appendingPathComponent("scribble.json")
            let jsonData = try JSONSerialization.data(withJSONObject: scribbleData, options: .prettyPrinted)
            try jsonData.write(to: jsonURL, options: .atomic)
            
            return true
        } catch {
            return false
        }
    }
}
