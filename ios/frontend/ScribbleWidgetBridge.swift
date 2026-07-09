import Foundation
import UIKit
import WidgetKit
import React
import CoreLocation

@objc(ScribbleWidgetBridge)
class ScribbleWidgetBridge: NSObject, CLLocationManagerDelegate {
    
    // App Group identifier - must match widget's App Group
    private let appGroupIdentifier = "group.com.thousandways.love"
    private var locationManager: CLLocationManager?
    private var backgroundLocationManager: CLLocationManager?
    private var locationResolver: RCTPromiseResolveBlock?
    private var locationRejecter: RCTPromiseRejectBlock?
    private let trackingUserIdKey = "distance_widget_tracking_user_id"
    private let trackingApiBaseKey = "distance_widget_tracking_api_base"
    
    /// Get the shared container URL for App Group
    private func getSharedContainerURL() -> URL? {
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }
    
    /// Save scribble path data as JSON to App Group for widget
    @objc
    func saveScribblePaths(_ pathsArray: NSArray, metadata: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        
        guard let containerURL = getSharedContainerURL() else {
            print("❌ App Group container not found!")
            rejecter("ERROR", "App Group container not found. Make sure App Group is configured.", nil)
            return
        }
        
        print("📁 App Group container URL: \(containerURL.path)")
        
        do {
            // Add version number to bust widget cache
            let version = Int(Date().timeIntervalSince1970 * 1000)
            
            // Create scribble data structure
            let scribbleData: [String: Any] = [
                "paths": pathsArray,
                "senderName": metadata["senderName"] ?? "Your Love",
                "timestamp": metadata["timestamp"] ?? ISO8601DateFormatter().string(from: Date()),
                "savedAt": ISO8601DateFormatter().string(from: Date()),
                "version": version  // Cache-busting version
            ]
            
            // Save as JSON with atomic write
            let jsonURL = containerURL.appendingPathComponent("scribble.json")
            let jsonData = try JSONSerialization.data(withJSONObject: scribbleData, options: .prettyPrinted)
            try jsonData.write(to: jsonURL, options: .atomic)
            
            print("✅ Scribble paths saved to App Group: \(jsonURL.path)")
            print("📊 Paths count: \(pathsArray.count), Version: \(version)")
            
            // Trigger widget refresh by specific kind
            if #available(iOS 14.0, *) {
                // Use specific kind name that matches the widget
                WidgetCenter.shared.reloadTimelines(ofKind: "ScribbleWidget")
                print("🔄 Widget refresh triggered for 'ScribbleWidget'")
                
                // Also call reloadAllTimelines as backup
                WidgetCenter.shared.reloadAllTimelines()
                print("🔄 All widget timelines reloaded")
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

    /// Save relationship start date for the Time Together lock screen widget
    @objc
    func saveTogetherStartDate(_ startDate: NSString, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard let containerURL = getSharedContainerURL() else {
            rejecter("ERROR", "App Group container not found. Make sure App Group is configured.", nil)
            return
        }

        do {
            let togetherData: [String: Any] = [
                "startDate": String(startDate),
                "savedAt": ISO8601DateFormatter().string(from: Date())
            ]
            let jsonURL = containerURL.appendingPathComponent("together.json")
            let jsonData = try JSONSerialization.data(withJSONObject: togetherData, options: .prettyPrinted)
            try jsonData.write(to: jsonURL, options: .atomic)

            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: "TogetherCountdownWidget")
                WidgetCenter.shared.reloadTimelines(ofKind: "TogetherDaysWidget")
            }

            resolver(true)
        } catch {
            rejecter("ERROR", "Failed to save together date: \(error.localizedDescription)", error)
        }
    }

    /// Clear relationship start date for the Time Together lock screen widget
    @objc
    func clearTogetherStartDate(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard let containerURL = getSharedContainerURL() else {
            resolver(false)
            return
        }

        let jsonURL = containerURL.appendingPathComponent("together.json")
        try? FileManager.default.removeItem(at: jsonURL)

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadTimelines(ofKind: "TogetherCountdownWidget")
            WidgetCenter.shared.reloadTimelines(ofKind: "TogetherDaysWidget")
        }

        resolver(true)
    }

    /// Request current location for the distance widget setup flow
    @objc
    func requestCurrentLocation(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if CLLocationManager.locationServicesEnabled() == false {
                rejecter("LOCATION_DISABLED", "Location services are disabled.", nil)
                return
            }

            let manager = CLLocationManager()
            self.locationManager = manager
            self.locationResolver = resolver
            self.locationRejecter = rejecter
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters

            let status = manager.authorizationStatus
            switch status {
            case .notDetermined:
                manager.requestWhenInUseAuthorization()
            case .authorizedWhenInUse, .authorizedAlways:
                manager.requestLocation()
            case .denied, .restricted:
                rejecter("LOCATION_DENIED", "Location permission is not granted.", nil)
                self.clearLocationPromise()
            @unknown default:
                rejecter("LOCATION_UNKNOWN", "Unable to determine location permission status.", nil)
                self.clearLocationPromise()
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager === backgroundLocationManager {
            switch manager.authorizationStatus {
            case .authorizedAlways, .authorizedWhenInUse:
                manager.startMonitoringSignificantLocationChanges()
            default:
                break
            }
            return
        }

        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        case .denied, .restricted:
            locationRejecter?("LOCATION_DENIED", "Location permission is not granted.", nil)
            clearLocationPromise()
        case .notDetermined:
            break
        @unknown default:
            locationRejecter?("LOCATION_UNKNOWN", "Unable to determine location permission status.", nil)
            clearLocationPromise()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else {
            locationRejecter?("LOCATION_UNAVAILABLE", "Current location is unavailable.", nil)
            clearLocationPromise()
            return
        }

        if manager === backgroundLocationManager || locationResolver == nil {
            syncDistanceWidgetInBackground(location: location)
            return
        }

        locationResolver?([
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy,
            "timestamp": ISO8601DateFormatter().string(from: location.timestamp)
        ])
        clearLocationPromise()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if manager === backgroundLocationManager {
            return
        }

        locationRejecter?("LOCATION_ERROR", "Failed to get current location: \(error.localizedDescription)", error)
        clearLocationPromise()
    }

    private func clearLocationPromise() {
        locationResolver = nil
        locationRejecter = nil
        locationManager?.delegate = nil
        locationManager = nil
    }

    /// Save distance data for the distance lock screen widget
    @objc
    func saveDistanceWidgetData(_ distanceData: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard let containerURL = getSharedContainerURL() else {
            rejecter("ERROR", "App Group container not found. Make sure App Group is configured.", nil)
            return
        }

        do {
            let jsonURL = containerURL.appendingPathComponent("distance.json")
            var payload = distanceData as? [String: Any] ?? [:]
            payload["savedAt"] = ISO8601DateFormatter().string(from: Date())
            let jsonData = try JSONSerialization.data(withJSONObject: payload, options: .prettyPrinted)
            try jsonData.write(to: jsonURL, options: .atomic)

            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: "DistanceWidget")
            }

            resolver(true)
        } catch {
            rejecter("ERROR", "Failed to save distance widget data: \(error.localizedDescription)", error)
        }
    }

    /// Clear distance data for the distance lock screen widget
    @objc
    func clearDistanceWidgetData(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard let containerURL = getSharedContainerURL() else {
            resolver(false)
            return
        }

        let jsonURL = containerURL.appendingPathComponent("distance.json")
        try? FileManager.default.removeItem(at: jsonURL)

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadTimelines(ofKind: "DistanceWidget")
        }

        resolver(true)
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

    /// Store parity with Android bridge. iOS widget status is reported by JS after reading WidgetKit configurations.
    @objc
    func setWidgetTrackingContext(_ userId: NSString, apiBase: NSString, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        if let defaults = UserDefaults(suiteName: appGroupIdentifier) {
            defaults.set(String(userId), forKey: trackingUserIdKey)
            defaults.set(String(apiBase), forKey: trackingApiBaseKey)
        }
        resolver(true)
    }

    /// Start battery-friendly background refresh for the Distance widget.
    @objc
    func startDistanceBackgroundUpdates(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard CLLocationManager.locationServicesEnabled() else {
                resolver(false)
                return
            }

            let manager = self.backgroundLocationManager ?? CLLocationManager()
            self.backgroundLocationManager = manager
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            manager.pausesLocationUpdatesAutomatically = true
            manager.allowsBackgroundLocationUpdates = true

            switch manager.authorizationStatus {
            case .notDetermined:
                manager.requestAlwaysAuthorization()
            case .authorizedWhenInUse:
                manager.requestAlwaysAuthorization()
                manager.startMonitoringSignificantLocationChanges()
            case .authorizedAlways:
                manager.startMonitoringSignificantLocationChanges()
            default:
                break
            }

            resolver(true)
        }
    }

    /// Stop background Distance widget refresh.
    @objc
    func stopDistanceBackgroundUpdates(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        backgroundLocationManager?.stopMonitoringSignificantLocationChanges()
        backgroundLocationManager?.delegate = nil
        backgroundLocationManager = nil
        resolver(true)
    }

    /// Return currently configured iOS widgets by kind.
    @objc
    func getWidgetConfigurations(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 14.0, *) else {
            resolver([:])
            return
        }

        WidgetCenter.shared.getCurrentConfigurations { result in
            switch result {
            case .success(let configurations):
                var counts: [String: Int] = [
                    "scribble": 0,
                    "togetherDays": 0,
                    "togetherCountdown": 0,
                    "distance": 0
                ]

                for configuration in configurations {
                    switch configuration.kind {
                    case "ScribbleWidget":
                        counts["scribble", default: 0] += 1
                    case "TogetherDaysWidget":
                        counts["togetherDays", default: 0] += 1
                    case "TogetherCountdownWidget":
                        counts["togetherCountdown", default: 0] += 1
                    case "DistanceWidget":
                        counts["distance", default: 0] += 1
                    default:
                        break
                    }
                }

                let payload = counts.reduce(into: [String: [String: Any]]()) { partialResult, item in
                    partialResult[item.key] = [
                        "installed": item.value > 0,
                        "activeCount": item.value
                    ]
                }

                resolver(payload)
            case .failure(let error):
                rejecter("ERROR", "Failed to read widget configurations: \(error.localizedDescription)", error)
            }
        }
    }

    private func syncDistanceWidgetInBackground(location: CLLocation) {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier),
              let userId = defaults.string(forKey: trackingUserIdKey),
              let apiBase = defaults.string(forKey: trackingApiBaseKey)?.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
              let locationURL = URL(string: "\(apiBase)/api/user/location"),
              let distanceURL = URL(string: "\(apiBase)/api/user/distance/\(userId)") else {
            return
        }

        var locationRequest = URLRequest(url: locationURL)
        locationRequest.httpMethod = "PUT"
        locationRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        locationRequest.httpBody = try? JSONSerialization.data(withJSONObject: [
            "userId": userId,
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "sharingEnabled": true
        ])

        URLSession.shared.dataTask(with: locationRequest) { _, response, error in
            guard error == nil,
                  let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                return
            }

            URLSession.shared.dataTask(with: distanceURL) { data, response, error in
                guard error == nil,
                      let data = data,
                      let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      json["success"] as? Bool == true else {
                    return
                }

                var payload = json["data"] as? [String: Any] ?? [:]
                payload["locked"] = false
                payload["isPremium"] = true
                payload["updatedAt"] = ISO8601DateFormatter().string(from: Date())
                self.saveDistancePayloadToWidget(payload)
            }.resume()
        }.resume()
    }

    private func saveDistancePayloadToWidget(_ payload: [String: Any]) {
        guard let containerURL = getSharedContainerURL() else {
            return
        }

        do {
            let jsonURL = containerURL.appendingPathComponent("distance.json")
            let jsonData = try JSONSerialization.data(withJSONObject: payload, options: .prettyPrinted)
            try jsonData.write(to: jsonURL, options: .atomic)

            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: "DistanceWidget")
            }
        } catch {
            print("❌ Failed to save background distance widget data: \(error)")
        }
    }
    
    /// Get scribble status from App Group (for debugging)
    @objc
    func getScribbleStatus(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard let containerURL = getSharedContainerURL() else {
            resolver([
                "success": false,
                "error": "App Group container not found",
                "containerPath": NSNull()
            ])
            return
        }
        
        let jsonURL = containerURL.appendingPathComponent("scribble.json")
        let fileExists = FileManager.default.fileExists(atPath: jsonURL.path)
        
        var result: [String: Any] = [
            "success": true,
            "containerPath": containerURL.path,
            "filePath": jsonURL.path,
            "fileExists": fileExists
        ]
        
        if fileExists {
            do {
                let data = try Data(contentsOf: jsonURL)
                result["fileSize"] = data.count
                
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let paths = json["paths"] as? [[String: Any]] ?? []
                    result["pathsCount"] = paths.count
                    result["senderName"] = json["senderName"] ?? NSNull()
                    result["version"] = json["version"] ?? NSNull()
                    result["savedAt"] = json["savedAt"] ?? NSNull()
                }
            } catch {
                result["readError"] = error.localizedDescription
            }
        }
        
        resolver(result)
    }
    
    /// Required for React Native modules
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
