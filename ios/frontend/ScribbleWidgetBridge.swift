import Foundation
import UIKit
import WidgetKit
import React

@objc(ScribbleWidgetBridge)
class ScribbleWidgetBridge: NSObject {
    
    // App Group identifier - must match widget's App Group
    private let appGroupIdentifier = "group.com.thousandways.love"
    
    /// Get the shared container URL for App Group
    private func getSharedContainerURL() -> URL? {
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }
    
    /// Save scribble path data as JSON to App Group for widget
    @objc
    func saveScribblePaths(_ pathsArray: NSArray, metadata: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        
        guard let containerURL = getSharedContainerURL() else {
            rejecter("ERROR", "App Group container not found. Make sure App Group is configured.", nil)
            return
        }
        
        do {
            // Create scribble data structure
            let scribbleData: [String: Any] = [
                "paths": pathsArray,
                "senderName": metadata["senderName"] ?? "Your Love",
                "timestamp": metadata["timestamp"] ?? ISO8601DateFormatter().string(from: Date()),
                "savedAt": ISO8601DateFormatter().string(from: Date())
            ]
            
            // Save as JSON
            let jsonURL = containerURL.appendingPathComponent("scribble.json")
            let jsonData = try JSONSerialization.data(withJSONObject: scribbleData, options: .prettyPrinted)
            try jsonData.write(to: jsonURL)
            
            print("✅ Scribble paths saved to App Group: \(jsonURL.path)")
            
            // Trigger widget refresh
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
                print("🔄 Widget refresh triggered")
            }
            
            resolver(true)
            
        } catch {
            print("❌ Error saving scribble paths: \(error)")
            rejecter("ERROR", "Failed to save scribble: \(error.localizedDescription)", error)
        }
    }
    
    /// Save scribble image to App Group (legacy method)
    @objc
    func saveScribbleImage(_ imagePath: String, metadata: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        
        guard let containerURL = getSharedContainerURL() else {
            rejecter("ERROR", "App Group container not found. Make sure App Group is configured.", nil)
            return
        }
        
        // Convert file path to URL
        let sourceURL: URL
        if imagePath.hasPrefix("file://") {
            sourceURL = URL(string: imagePath)!
        } else {
            sourceURL = URL(fileURLWithPath: imagePath)
        }
        
        // Destination path in App Group
        let destinationURL = containerURL.appendingPathComponent("scribble_image.png")
        
        do {
            // Read image data
            let imageData = try Data(contentsOf: sourceURL)
            
            // Write to shared container
            try imageData.write(to: destinationURL)
            
            // Save metadata as JSON
            let metadataURL = containerURL.appendingPathComponent("scribble_meta.json")
            let metadataDict: [String: Any] = [
                "senderName": metadata["senderName"] ?? "Your Love",
                "timestamp": metadata["timestamp"] ?? ISO8601DateFormatter().string(from: Date()),
                "savedAt": ISO8601DateFormatter().string(from: Date())
            ]
            let jsonData = try JSONSerialization.data(withJSONObject: metadataDict)
            try jsonData.write(to: metadataURL)
            
            print("✅ Scribble saved to App Group: \(destinationURL.path)")
            resolver(true)
            
        } catch {
            print("❌ Error saving scribble: \(error)")
            rejecter("ERROR", "Failed to save scribble image: \(error.localizedDescription)", error)
        }
    }
    
    /// Trigger widget refresh
    @objc
    func refreshWidget(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
            print("🔄 Widget timelines reloaded")
            resolver(true)
        } else {
            resolver(false)
        }
    }
    
    /// Check if widget is available
    @objc
    func isWidgetAvailable(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 14.0, *) {
            resolver(true)
        } else {
            resolver(false)
        }
    }
    
    /// Required for React Native modules
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
