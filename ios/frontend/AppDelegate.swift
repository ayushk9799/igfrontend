import UIKit
import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import RNBootSplash

import GoogleSignIn
import WidgetKit

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Initialize Firebase
    FirebaseApp.configure()
    
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    window = UIWindow(frame: UIScreen.main.bounds)
    window?.backgroundColor = UIColor(
      red: 248.0 / 255.0,
      green: 221.0 / 255.0,
      blue: 244.0 / 255.0,
      alpha: 1.0
    )

    factory.startReactNative(
      withModuleName: "Penguin",
      in: window,
      launchOptions: launchOptions
    )

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  // Handle Google Sign-In URL redirect
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    if GIDSignIn.sharedInstance.handle(url) {
      return true
    }
    return super.application(app, open: url, options: options)
  }
  
  // Refresh widgets when app becomes active
  override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    if #available(iOS 14.0, *) {
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "ScribbleWidget")
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "CouplePhotoWidget")
    }
  }
  
  // Refresh widgets when app enters background (closes)
  override func applicationDidEnterBackground(_ application: UIApplication) {
    super.applicationDidEnterBackground(application)
    if #available(iOS 14.0, *) {
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "ScribbleWidget")
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "CouplePhotoWidget")
    }
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func customize(_ rootView: UIView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
