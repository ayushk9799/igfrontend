import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase

import GoogleSignIn
import WidgetKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Initialize Firebase
    FirebaseApp.configure()
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "frontend",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
  
  // Handle Google Sign-In URL redirect
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    if GIDSignIn.sharedInstance.handle(url) {
      return true
    }
    return false
  }
  
  // Refresh widget when app becomes active
  func applicationDidBecomeActive(_ application: UIApplication) {
    // Refresh the scribble widget to show latest data
    if #available(iOS 14.0, *) {
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "ScribbleWidget")
    }
  }
  
  // Refresh widget when app enters background (closes)
  func applicationDidEnterBackground(_ application: UIApplication) {
    // Refresh the scribble widget to show any new data received while app was open
    if #available(iOS 14.0, *) {
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "ScribbleWidget")
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
