import UIKit
import React_RCTAppDelegate
import GoogleSignIn
import WidgetKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = (scene as? UIWindowScene) else { return }

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    window.backgroundColor = UIColor(
      red: 248.0 / 255.0,
      green: 221.0 / 255.0,
      blue: 244.0 / 255.0,
      alpha: 1.0
    )

    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "Penguin",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
  }

  // Handle URL redirects (e.g. Google Sign-In)
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = GIDSignIn.sharedInstance.handle(context.url)
    }
  }

  // Refresh widgets when scene becomes active
  func sceneDidBecomeActive(_ scene: UIScene) {
    if #available(iOS 14.0, *) {
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "ScribbleWidget")
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "CouplePhotoWidget")
    }
  }

  // Refresh widgets when scene enters background
  func sceneDidEnterBackground(_ scene: UIScene) {
    if #available(iOS 14.0, *) {
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "ScribbleWidget")
      WidgetKit.WidgetCenter.shared.reloadTimelines(ofKind: "CouplePhotoWidget")
    }
  }
}
