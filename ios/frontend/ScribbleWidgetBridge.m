//
//  ScribbleWidgetBridge.m
//  frontend
//
//  Objective-C macro to expose Swift module to React Native
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ScribbleWidgetBridge, NSObject)

RCT_EXTERN_METHOD(saveScribblePaths:(NSArray *)pathsArray
                  metadata:(NSDictionary *)metadata
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(saveScribbleImage:(NSString *)imagePath
                  metadata:(NSDictionary *)metadata
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(refreshWidget:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isWidgetAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
