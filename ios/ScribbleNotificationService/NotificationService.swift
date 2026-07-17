//
//  NotificationService.swift
//  ScribbleNotificationService
//
//  Notification Service Extension to process scribble notifications
//  and update widget when app is killed
//

import Foundation
import UserNotifications
import WidgetKit

class NotificationService: UNNotificationServiceExtension {
    
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    private var fetchTask: URLSessionDataTask?
    private var didFinish = false
    private let finishLock = NSLock()
    
    private let appGroupIdentifier = "group.com.thousandways.love"
    private let widgetKind = "ScribbleWidget"  // Must match Widget's kind
    
    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        guard bestAttemptContent != nil else {
            finish(with: request.content)
            return
        }
        
        let userInfo = request.content.userInfo
        
        // Extract data - FCM puts data fields at ROOT level of userInfo
        let type = userInfo["type"] as? String
        guard type == "scribble" else {
            finish()
            return
        }

        // New payloads contain a signed URL for the current shared canvas.
        // Keeping the legacy parser supports older app builds during rollout.
        if let scribbleUrlString = userInfo["scribbleUrl"] as? String,
           let scribbleUrl = URL(string: scribbleUrlString) {
            fetchCurrentScribble(from: scribbleUrl)
            return
        }

        if let pathsString = userInfo["paths"] as? String,
           let pathsData = pathsString.data(using: .utf8),
           let paths = try? JSONSerialization.jsonObject(with: pathsData) as? [[String: Any]] {
            let legacyCanvasWidth = parseDimension(userInfo["canvasWidth"], fallback: 350)
            saveAndReloadWidget(
                paths: paths,
                senderName: userInfo["senderName"] as? String ?? "Your Love",
                timestamp: userInfo["timestamp"] as? String ?? ISO8601DateFormatter().string(from: Date()),
                canvasWidth: legacyCanvasWidth,
                canvasHeight: parseDimension(userInfo["canvasHeight"], fallback: legacyCanvasWidth),
                canvasRevision: parseRevision(userInfo["canvasRevision"])
            )
        }

        finish()
    }
    
    override func serviceExtensionTimeWillExpire() {
        fetchTask?.cancel()
        finish()
    }

    private func fetchCurrentScribble(from url: URL) {
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 20

        fetchTask = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            defer { self.finish() }

            guard error == nil,
                  let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode),
                  let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let scribble = json["data"] as? [String: Any],
                  let paths = scribble["paths"] as? [[String: Any]] else {
                return
            }

            let canvasWidth = self.parseDimension(scribble["canvasWidth"], fallback: 350)
            let canvasHeight = self.parseDimension(scribble["canvasHeight"], fallback: canvasWidth)

            self.saveAndReloadWidget(
                paths: paths,
                senderName: scribble["senderName"] as? String ?? "Your Love",
                timestamp: scribble["timestamp"] as? String ?? ISO8601DateFormatter().string(from: Date()),
                canvasWidth: canvasWidth,
                canvasHeight: canvasHeight,
                canvasRevision: self.parseRevision(scribble["canvasRevision"])
            )
        }
        fetchTask?.resume()
    }

    private func saveAndReloadWidget(
        paths: [[String: Any]],
        senderName: String,
        timestamp: String,
        canvasWidth: Double,
        canvasHeight: Double,
        canvasRevision: Int64
    ) {
        if saveScribbleToAppGroup(
            paths: paths,
            senderName: senderName,
            timestamp: timestamp,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            canvasRevision: canvasRevision
        ) {
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
            }
        }
    }

    private func finish(with fallbackContent: UNNotificationContent? = nil) {
        finishLock.lock()
        guard !didFinish else {
            finishLock.unlock()
            return
        }
        didFinish = true
        let handler = contentHandler
        let content = fallbackContent ?? bestAttemptContent
        finishLock.unlock()

        if let handler = handler, let content = content {
            handler(content)
        }
    }
    
    private func parseDimension(_ value: Any?, fallback: Double) -> Double {
        if let number = value as? NSNumber, number.doubleValue > 0 {
            return number.doubleValue
        }
        if let string = value as? String, let number = Double(string), number > 0 {
            return number
        }
        return fallback
    }

    private func parseRevision(_ value: Any?) -> Int64 {
        if let number = value as? NSNumber {
            return number.int64Value
        }
        if let string = value as? String, let number = Int64(string) {
            return number
        }
        return Int64(Date().timeIntervalSince1970 * 1000)
    }

    private func parseTimestamp(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
    
    private func saveScribbleToAppGroup(
        paths: [[String: Any]],
        senderName: String,
        timestamp: String,
        canvasWidth: Double,
        canvasHeight: Double,
        canvasRevision: Int64
    ) -> Bool {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            return false
        }
        
        do {
            let jsonURL = containerURL.appendingPathComponent("scribble.json")

            // A delayed push must never overwrite a newer shared-canvas state
            // that arrived through Socket.IO or a more recent notification.
            if let existingData = try? Data(contentsOf: jsonURL),
               let existing = try? JSONSerialization.jsonObject(with: existingData) as? [String: Any],
               let existingTimestamp = existing["timestamp"] as? String,
               let existingDate = parseTimestamp(existingTimestamp),
               let incomingDate = parseTimestamp(timestamp),
               existingDate > incomingDate {
                return true
            }

            // Add a unique version number to ensure widget sees this as new data
            let version = Int(Date().timeIntervalSince1970 * 1000)
            
            let scribbleData: [String: Any] = [
                "paths": paths,
                "senderName": senderName,
                "timestamp": timestamp,
                "canvasWidth": canvasWidth,
                "canvasHeight": canvasHeight,
                "savedAt": ISO8601DateFormatter().string(from: Date()),
                "canvasRevision": canvasRevision,
                "version": version  // Unique version to bust cache
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: scribbleData, options: .prettyPrinted)
            try jsonData.write(to: jsonURL, options: .atomic)
            
            return true
        } catch {
            return false
        }
    }
}
