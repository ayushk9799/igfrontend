//
//  ScribbleWidget.swift
//  ScribbleWidget
//
//  Created by AYUSH KUMAR on 17/12/25.
//  Widget that renders partner's scribble paths natively
//

import WidgetKit
import SwiftUI

// MARK: - Widget Entry
struct ScribbleEntry: TimelineEntry {
    let date: Date
    let paths: [[String: Any]]
    let senderName: String
    let hasScribble: Bool
}

// MARK: - Timeline Provider
struct ScribbleProvider: TimelineProvider {
    
    private let appGroupIdentifier = "group.com.thousandways.love"
    
    func placeholder(in context: Context) -> ScribbleEntry {
        ScribbleEntry(date: Date(), paths: [], senderName: "Your Love", hasScribble: false)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (ScribbleEntry) -> Void) {
        let entry = loadScribbleEntry()
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<ScribbleEntry>) -> Void) {
        let entry = loadScribbleEntry()
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
    
    private func loadScribbleEntry() -> ScribbleEntry {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            return ScribbleEntry(date: Date(), paths: [], senderName: "Your Love", hasScribble: false)
        }
        
        let jsonURL = containerURL.appendingPathComponent("scribble.json")
        
        guard let data = try? Data(contentsOf: jsonURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ScribbleEntry(date: Date(), paths: [], senderName: "Your Love", hasScribble: false)
        }
        
        let paths = json["paths"] as? [[String: Any]] ?? []
        let senderName = json["senderName"] as? String ?? "Your Love"
        
        return ScribbleEntry(
            date: Date(),
            paths: paths,
            senderName: senderName,
            hasScribble: !paths.isEmpty
        )
    }
}

// MARK: - Placeholder Heart Paths (drawn heart doodle)
struct PlaceholderHeart {
    static let paths: [[String: Any]] = [
        [
            "d": "M159.3,109.0 L156.0,105.7 L150.7,101.7 L147.3,98.7 L144.0,96.0 L140.3,93.0 L136.0,90.7 L130.0,89.0 L122.7,88.7 L113.3,88.7 L103.3,93.0 L94.3,99.3 L86.7,107.0 L80.3,115.7 L75.7,124.0 L74.0,131.7 L73.7,138.7 L74.0,145.0 L78.0,151.0 L84.0,157.0 L91.0,162.7 L98.3,167.3 L107.0,171.3 L116.0,174.0 L124.0,176.7 L131.3,180.0 L138.7,184.0 L145.0,188.7 L151.3,194.3 L156.7,199.0 L161.3,203.3 L165.3,207.0 L168.3,210.7 L171.3,214.0 L174.7,218.0 L177.0,222.0 L179.3,226.3 L180.7,229.3 L181.3,231.0 L181.3,231.3",
            "color": "#FF6B6B",
            "strokeWidth": 3
        ],
        [
            "d": "M168.0,108.3 L167.0,96.0 L168.0,91.7 L171.0,85.3 L174.7,78.0 L179.7,70.7 L185.0,64.3 L191.3,58.7 L198.7,53.7 L206.7,49.7 L215.3,47.0 L223.3,45.3 L231.0,44.7 L238.0,44.7 L244.3,45.0 L249.0,48.3 L253.0,52.0 L256.7,56.7 L259.0,61.7 L260.0,67.0 L260.3,72.7 L260.3,78.0 L260.3,83.0 L260.3,88.7 L259.7,94.7 L257.3,100.0 L254.7,105.3 L252.0,111.0 L250.0,116.3 L247.3,121.3 L244.7,126.3 L241.7,131.3 L238.3,136.0 L234.7,141.3 L230.3,146.0 L226.0,150.3 L221.7,155.3 L217.3,160.3 L212.3,165.3 L207.3,170.3 L202.7,174.7 L198.3,179.3 L194.7,184.0 L191.3,189.0 L188.7,194.7 L186.7,200.3 L185.7,205.7 L185.0,210.7 L184.3,215.7 L184.3,220.0 L184.3,224.0 L184.3,227.3 L184.3,229.7 L184.3,231.3 L184.3,232.0 L184.0,232.0",
            "color": "#F97068",
            "strokeWidth": 3
        ],
        [
    "d": "M95.0,115.7 L105.0,107.3 L109.3,104.7 L114.3,101.0 L119.7,96.7 L124.0,93.3 L127.3,90.7 L128.3,89.7 L124.3,91.7 L118.0,98.3 L111.7,105.3 L105.0,112.3 L98.7,120.0 L94.0,127.0 L91.7,130.7 L91.3,131.0 L95.7,128.7 L104.3,120.7 L112.7,114.0 L120.0,108.7 L123.7,105.3 L124.7,104.3 L124.3,104.7 L120.7,109.7 L114.0,117.0 L107.3,124.7 L101.3,131.7 L97.7,137.0 L97.0,138.7 L97.7,138.3 L106.0,132.3 L116.3,123.0 L125.7,113.7 L133.0,107.3 L136.0,105.3 L131.0,110.0 L121.3,119.0 L111.3,128.7 L101.7,138.0 L93.7,145.3 L90.7,148.3 L90.3,148.7 L95.3,143.7 L105.7,133.3 L118.3,121.3 L129.3,111.0 L138.3,103.3 L141.7,100.7 L142.0,100.3 L137.0,103.3 L127.7,112.3 L117.3,123.0 L107.3,133.3 L98.3,143.0 L92.7,150.3 L91.7,153.3 L92.3,153.7 L100.3,148.3 L112.7,137.3 L125.0,125.7 L136.0,116.7 L143.7,111.7 L145.3,111.3 L145.3,113.0 L140.3,121.7 L132.3,131.3 L124.3,141.0 L117.3,149.0 L112.7,154.3 L112.0,155.7 L113.0,155.0 L122.3,147.7 L135.3,136.3 L147.0,125.7 L156.0,118.3 L159.3,116.0 L155.7,119.0 L146.7,127.0 L136.7,136.3 L126.3,146.7 L117.7,156.0 L112.7,162.3 L112.7,163.7 L113.7,162.7 L123.7,153.0 L136.7,140.0 L150.0,126.3 L160.7,116.0 L166.3,111.7 L166.7,111.3 L164.7,115.3 L155.0,125.7 L144.0,137.3 L133.0,149.3 L123.3,159.3 L119.0,166.3 L118.7,168.0 L122.0,167.0 L134.3,157.7 L148.3,143.7 L163.3,128.3 L175.0,117.3 L180.3,114.7 L180.3,115.0 L177.3,121.7 L168.3,131.3 L157.3,143.0 L145.7,154.0 L137.3,163.3 L133.7,167.7 L133.7,168.0 L139.0,163.7 L151.0,151.3 L167.0,135.3 L184.0,121.3 L196.7,113.3 L200.0,112.0 L199.3,113.7 L190.7,124.3 L178.0,137.0 L165.7,149.0 L154.0,159.0 L146.3,166.3 L144.7,169.0 L145.3,169.0 L154.0,163.7 L168.3,151.0 L184.7,137.7 L198.0,127.7 L205.7,124.0 L206.3,124.0 L203.3,129.0 L193.7,139.3 L182.3,150.0 L171.0,160.7 L163.0,168.3 L159.7,171.3 L159.3,171.3 L165.0,165.0 L176.0,152.3 L190.3,139.3 L202.7,130.0 L210.0,126.3 L210.7,126.7 L205.7,132.7 L194.3,145.0 L181.3,158.0 L169.3,169.7 L160.3,178.3 L156.3,182.0 L156.0,182.3 L157.7,180.7 L164.7,172.0 L173.0,160.3 L181.3,150.7 L187.3,146.0 L189.0,145.7 L188.3,149.3 L182.7,161.0 L176.0,173.7 L170.3,184.3 L167.0,190.7 L166.7,192.0 L166.7,191.3 L171.0,184.0 L180.3,171.3 L190.0,158.0 L196.7,150.0 L198.3,147.3 L198.3,147.7 L192.7,155.0 L183.0,166.3 L174.0,179.0 L167.0,190.0 L163.3,198.3 L163.0,201.7 L163.3,201.7 L169.0,199.3 L177.3,190.0 L187.0,178.3 L194.3,169.7 L197.7,166.0 L197.7,166.3 L196.0,172.7 L188.7,182.7 L181.0,193.0 L174.7,201.0 L171.7,205.7 L171.3,207.0 L171.7,207.0 L175.7,206.0 L182.0,201.3 L186.7,198.0 L189.3,196.7 L189.3,198.0 L187.0,204.0 L183.3,210.0 L181.0,215.0 L179.3,218.3 L178.7,219.7 L178.7,218.3 L178.7,211.3 L179.3,196.3 L184.3,177.0 L193.3,157.7 L203.7,140.0 L214.0,124.3 L221.3,113.3 L224.3,109.7 L222.7,111.7 L215.7,118.7 L206.7,127.0 L198.3,137.7 L191.0,149.3 L186.0,159.3 L183.7,165.7 L183.7,166.7 L185.3,165.3 L193.0,156.0 L203.0,142.3 L213.3,128.0 L221.0,117.7 L224.0,113.3 L224.3,113.0 L223.7,113.7 L217.7,120.7 L209.0,131.7 L200.0,144.0 L193.3,154.7 L189.7,162.7 L189.0,165.7 L193.0,164.3 L201.0,155.3 L212.0,143.3 L222.0,130.7 L230.0,121.7 L233.7,119.0 L229.0,125.7 L220.3,135.3 L210.7,146.7 L201.7,156.3 L197.0,162.7 L196.0,164.3 L200.3,160.3 L210.3,150.3 L221.7,136.3 L233.3,121.7 L242.0,110.3 L245.3,106.0 L243.0,108.7 L233.3,118.0 L222.0,128.7 L212.0,140.7 L203.7,151.0 L198.3,159.0 L197.7,162.0 L201.7,156.0 L209.3,144.3 L218.3,130.3 L227.7,116.0 L236.3,103.7 L242.3,95.7 L243.7,94.0 L243.3,95.7 L235.3,105.3 L223.0,119.0 L210.7,134.3 L200.0,148.7 L194.3,159.3 L193.0,164.7 L193.3,165.0 L198.7,161.7 L209.7,151.7 L222.7,138.3 L235.3,126.3 L244.3,119.0 L246.3,118.0 L245.7,119.0 L237.7,128.0 L227.7,137.7 L218.3,147.0 L211.3,154.3 L207.7,158.3 L207.0,159.7 L209.7,159.0 L215.3,153.0 L221.3,144.0 L228.0,132.3 L235.3,119.0 L241.7,103.7 L246.3,90.0 L249.0,81.7 L249.0,80.7 L245.7,81.3 L232.7,89.3 L215.7,100.0 L198.0,112.3 L182.3,125.7 L170.7,135.3 L166.0,139.7 L166.0,139.3 L169.3,133.7 L180.7,119.7 L195.0,102.3 L209.7,85.3 L221.3,71.0 L226.3,63.7 L226.3,63.0 L222.3,65.0 L209.7,74.0 L194.7,87.7 L180.0,101.7 L167.7,113.7 L161.0,121.3 L160.0,122.3 L160.7,121.3 L168.0,111.7 L179.7,97.7 L193.7,82.0 L206.7,67.7 L216.7,56.7 L220.3,52.0 L220.3,51.7 L216.7,52.7 L206.0,60.3 L193.7,70.7 L181.3,80.7 L171.7,89.0 L167.0,93.7 L166.7,94.0 L167.3,92.7 L175.7,83.3 L188.7,72.3 L202.3,60.3 L214.0,50.3 L220.0,45.7 L220.3,45.3 L219.7,45.3 L213.7,49.7 L204.7,58.3 L195.7,67.3 L188.0,74.7 L182.0,80.7 L179.3,84.3 L179.0,85.0 L183.0,84.7 L191.7,79.7 L201.3,73.0 L211.3,66.7 L219.7,61.7 L225.0,58.0 L226.7,57.3 L226.7,58.3 L222.3,68.0 L214.0,80.3 L205.3,92.7 L197.0,103.3 L191.0,111.3 L190.0,114.3 L196.7,111.3 L207.3,102.0 L220.3,90.3 L231.7,79.0 L239.7,71.3 L242.0,69.3 L237.0,74.0 L226.3,86.3 L213.7,100.0 L201.0,113.0 L190.7,126.0 L184.3,136.7 L182.3,144.7 L182.7,146.3 L189.3,145.0 L199.0,136.3 L212.3,124.3 L225.7,110.0 L237.7,97.3 L245.0,90.0 L246.0,89.7 L244.3,93.3 L233.0,104.0 L221.0,115.3 L208.3,127.0 L197.3,138.3 L190.0,147.0 L188.7,149.7 L189.7,149.7 L197.7,142.3 L210.0,130.0 L224.3,114.0 L238.0,97.0 L248.7,82.0 L254.0,72.3 L254.3,69.0 L252.3,69.0 L241.3,69.7 L225.7,76.0 L209.3,84.7 L197.0,92.0 L191.0,96.0 L190.3,96.3 L191.7,95.7 L201.0,88.3 L213.3,77.7 L226.3,67.3 L237.3,57.7 L244.3,51.7 L244.3,50.3 L239.3,51.0 L230.3,55.7 L221.0,62.3 L213.3,68.3 L209.7,72.3 L209.3,73.0 L210.0,73.0 L217.0,69.3 L225.7,63.3 L234.7,58.0 L241.7,55.0 L244.3,54.3 L244.3,54.7 L241.7,60.3 L234.0,71.7 L227.0,84.7 L221.7,99.3 L221.0,103.7",
    "color": "#F97068",
    "strokeWidth": 4
        ],
        [
            "d": "M115.0,108.3 L113.0,109.0 L107.0,113.7 L102.0,119.7 L96.7,127.0 L91.7,133.0 L89.0,136.7 L88.3,137.7 L88.7,137.3 L95.0,132.0 L103.0,123.7 L111.0,115.7 L117.7,108.7 L122.3,104.0 L123.7,102.3 L123.7,102.0 L123.0,102.7 L118.0,108.3 L111.3,116.3 L104.3,124.0 L98.3,130.3 L95.3,133.3 L97.3,130.7 L105.0,122.3 L113.0,112.7 L120.3,104.0 L125.0,97.7 L126.0,95.7 L122.3,95.7 L114.3,99.3 L105.0,105.0 L96.3,111.3 L89.0,117.7 L84.7,121.0 L84.0,121.7 L85.0,121.0 L92.7,114.7 L102.3,105.3 L112.7,96.7 L120.0,90.7 L122.7,88.3 L122.0,88.3 L117.3,92.3 L116.0,93.7",
    "color": "#FF6B6B",
    "strokeWidth": 4
        ],
        [
            "d": "M123.3,108.0 L112.7,111.3 L108.3,114.7 L102.0,121.7 L95.3,130.3 L89.7,138.3 L87.0,143.3 L87.0,144.3 L91.7,143.3 L102.7,135.7 L114.7,126.7 L125.3,119.3 L133.3,115.7 L136.3,115.0 L136.7,115.0 L135.3,119.7 L128.7,129.3 L122.0,140.7 L115.7,150.0 L111.3,156.7 L109.7,158.3 L114.3,155.0 L125.0,145.3 L137.7,133.7 L148.7,124.3 L156.0,119.3 L158.0,119.0 L155.3,122.0 L148.0,128.7 L139.0,137.7 L129.7,146.3 L123.7,152.3 L121.7,154.3 L122.0,154.3 L129.0,151.0 L141.0,142.3 L152.0,132.7 L161.0,127.0 L165.7,125.0 L166.0,125.0 L163.7,128.3 L154.3,137.3 L143.7,148.3 L132.7,159.0 L124.3,167.3 L121.7,170.7 L122.0,171.0 L129.3,167.3 L143.3,157.0 L158.7,144.3 L173.0,134.3 L183.0,128.3 L187.3,127.3 L187.3,127.7 L183.7,134.3 L173.7,144.7 L162.0,156.7 L151.0,166.3 L143.7,173.7 L142.0,176.0 L142.7,176.0 L151.7,170.3 L167.3,158.3 L184.3,145.3 L199.3,135.0 L208.3,130.7 L210.0,130.3 L209.3,132.0 L200.7,141.0 L189.3,152.3 L175.7,164.3 L165.3,173.3 L160.0,177.3 L160.0,177.7 L162.7,176.3 L173.3,168.3 L187.0,157.7 L199.7,148.7 L208.3,144.7 L210.0,144.3 L209.0,145.7 L199.7,154.0 L187.3,165.0 L173.7,175.3 L162.3,183.0 L156.3,186.3 L156.0,186.3 L158.7,183.3 L169.3,173.0 L183.7,159.0 L197.7,147.7 L206.3,141.3 L208.7,140.3 L207.7,141.3 L198.0,149.7 L186.0,160.7 L172.3,172.3 L162.0,180.7 L158.0,184.7 L161.7,183.7 L172.3,177.7 L183.7,171.7 L194.0,166.7 L199.3,164.7 L199.7,164.7 L197.3,166.7 L187.7,174.3 L177.3,182.7 L168.7,189.3 L164.0,193.7 L163.7,194.3 L164.3,194.3 L170.7,190.3 L178.7,185.7 L185.7,182.3 L189.7,181.7 L190.0,181.7 L189.0,183.3 L182.3,190.0 L176.0,196.0 L172.3,199.0 L171.7,199.7 L174.7,199.0 L180.3,196.7 L184.7,195.3 L187.7,195.3 L188.3,195.3 L188.0,197.7 L185.0,202.7 L181.7,205.7 L179.7,207.0 L179.0,207.3 L179.0,207.0 L180.3,200.3 L186.7,187.0 L194.7,170.0 L202.7,151.3 L211.0,133.0 L217.3,117.0 L221.3,106.3 L222.0,103.7 L217.3,103.7 L207.7,106.0 L197.7,109.7 L190.7,112.0 L189.0,112.7 L196.3,110.0 L209.0,102.0 L222.0,93.7 L232.7,87.3 L238.0,84.0 L238.3,83.7 L237.3,83.7 L229.7,84.7 L220.7,87.7 L210.3,91.0 L201.3,94.3 L196.0,96.0 L195.0,96.3 L196.3,96.3 L206.3,93.0 L219.7,85.0 L232.3,78.0 L242.3,74.0 L246.3,73.0 L246.3,73.3 L240.0,78.3 L226.3,88.3 L210.7,99.7 L197.0,110.0 L189.0,117.0 L187.7,119.0 L188.3,119.3 L197.0,119.0 L211.7,113.0 L227.7,106.7 L241.7,102.0 L249.7,99.7 L251.0,99.7 L247.7,100.3 L234.7,107.3 L218.3,117.7 L201.3,127.3 L188.7,135.3 L181.3,139.7 L180.7,140.0 L182.3,140.0 L193.7,135.7 L209.7,127.7 L225.7,119.3 L238.3,112.3 L244.0,109.0 L236.7,109.0 L222.0,111.0 L204.7,116.3 L187.0,121.3 L173.3,125.3 L168.3,126.0 L175.3,121.3 L190.0,109.7 L206.3,96.0 L222.3,83.0 L236.0,71.7 L243.0,64.7 L243.3,63.7 L238.7,63.7 L226.3,64.7 L212.3,68.7 L199.3,73.3 L191.3,77.3 L190.0,78.7 L195.0,78.0 L204.3,71.7 L214.7,64.7 L223.3,58.7 L228.3,55.7 L229.0,55.0 L225.7,55.0 L218.3,56.3 L210.7,59.3 L204.7,62.0 L202.0,63.3 L202.0,63.7 L206.0,63.3 L216.0,58.7 L225.3,53.0 L233.0,49.0 L237.7,47.3 L238.3,47.3 L238.0,47.7 L232.3,52.7 L223.7,60.7 L213.7,69.3 L204.7,77.0 L198.0,83.3 L195.7,87.7 L195.7,88.7 L199.3,89.0 L210.0,88.3 L221.7,83.3 L232.7,78.7 L240.3,76.7 L242.7,76.3 L241.7,80.3 L230.7,90.3 L216.7,102.0 L202.0,112.7 L188.7,122.3 L178.3,130.7 L173.7,135.3 L173.7,136.3 L175.7,136.3 L185.7,134.0 L197.7,129.7 L211.3,124.0 L222.7,118.0 L229.3,113.7 L231.0,112.7 L230.7,112.7 L226.0,116.0 L217.0,124.7 L206.0,134.0 L196.7,142.0 L190.3,146.7 L189.7,147.7 L190.0,147.7 L197.7,145.7 L209.3,140.3 L220.3,135.3 L228.3,133.0 L231.3,132.0 L231.3,132.3 L229.0,132.7 L222.7,136.0 L217.7,139.0 L215.3,140.3 L217.0,139.3 L226.7,132.3 L238.3,123.3 L249.3,113.0 L258.3,103.3 L264.7,96.0 L266.3,93.3 L263.0,93.3 L255.0,95.7 L245.3,99.0 L236.7,102.3 L230.7,104.3 L228.7,105.0",
    "color": "#FF6B6B",
    "strokeWidth": 4
        ]
    ]
}

// MARK: - SVG Path Parser
struct SVGPathParser {
    
    static func parse(_ pathString: String, scale: CGFloat = 1.0) -> Path {
        var path = Path()
        let commands = tokenize(pathString)
        
        var currentPoint = CGPoint.zero
        var i = 0
        
        while i < commands.count {
            let cmd = commands[i]
            i += 1
            
            switch cmd {
            case "M", "m":
                if i + 1 < commands.count,
                   let x = Double(commands[i]),
                   let y = Double(commands[i + 1]) {
                    let point = CGPoint(x: x * scale, y: y * scale)
                    if cmd == "m" {
                        currentPoint = CGPoint(x: currentPoint.x + point.x, y: currentPoint.y + point.y)
                    } else {
                        currentPoint = point
                    }
                    path.move(to: currentPoint)
                    i += 2
                }
                
            case "L", "l":
                if i + 1 < commands.count,
                   let x = Double(commands[i]),
                   let y = Double(commands[i + 1]) {
                    let point = CGPoint(x: x * scale, y: y * scale)
                    if cmd == "l" {
                        currentPoint = CGPoint(x: currentPoint.x + point.x, y: currentPoint.y + point.y)
                    } else {
                        currentPoint = point
                    }
                    path.addLine(to: currentPoint)
                    i += 2
                }
                
            case "Q", "q":
                if i + 3 < commands.count,
                   let x1 = Double(commands[i]),
                   let y1 = Double(commands[i + 1]),
                   let x2 = Double(commands[i + 2]),
                   let y2 = Double(commands[i + 3]) {
                    var control = CGPoint(x: x1 * scale, y: y1 * scale)
                    var end = CGPoint(x: x2 * scale, y: y2 * scale)
                    
                    if cmd == "q" {
                        control = CGPoint(x: currentPoint.x + control.x, y: currentPoint.y + control.y)
                        end = CGPoint(x: currentPoint.x + end.x, y: currentPoint.y + end.y)
                    }
                    
                    path.addQuadCurve(to: end, control: control)
                    currentPoint = end
                    i += 4
                }
                
            case "C", "c":
                if i + 5 < commands.count,
                   let x1 = Double(commands[i]),
                   let y1 = Double(commands[i + 1]),
                   let x2 = Double(commands[i + 2]),
                   let y2 = Double(commands[i + 3]),
                   let x3 = Double(commands[i + 4]),
                   let y3 = Double(commands[i + 5]) {
                    var control1 = CGPoint(x: x1 * scale, y: y1 * scale)
                    var control2 = CGPoint(x: x2 * scale, y: y2 * scale)
                    var end = CGPoint(x: x3 * scale, y: y3 * scale)
                    
                    if cmd == "c" {
                        control1 = CGPoint(x: currentPoint.x + control1.x, y: currentPoint.y + control1.y)
                        control2 = CGPoint(x: currentPoint.x + control2.x, y: currentPoint.y + control2.y)
                        end = CGPoint(x: currentPoint.x + end.x, y: currentPoint.y + end.y)
                    }
                    
                    path.addCurve(to: end, control1: control1, control2: control2)
                    currentPoint = end
                    i += 6
                }
                
            case "Z", "z":
                path.closeSubpath()
                
            default:
                break
            }
        }
        
        return path
    }
    
    private static func tokenize(_ pathString: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        
        for char in pathString {
            if char.isLetter {
                if !current.isEmpty {
                    tokens.append(current)
                    current = ""
                }
                tokens.append(String(char))
            } else if char == "," || char == " " {
                if !current.isEmpty {
                    tokens.append(current)
                    current = ""
                }
            } else if char == "-" && !current.isEmpty {
                tokens.append(current)
                current = String(char)
            } else {
                current.append(char)
            }
        }
        
        if !current.isEmpty {
            tokens.append(current)
        }
        
        return tokens
    }
}

// MARK: - Scribble Path View
struct ScribblePathView: View {
    let paths: [[String: Any]]
    let canvasSize: CGFloat
    
    var body: some View {
        Canvas { context, size in
            let scale = size.width / canvasSize
            
            for pathData in paths {
                guard let d = pathData["d"] as? String else { continue }
                
                let colorHex = pathData["color"] as? String ?? "#FFFFFF"
                let strokeWidth = pathData["strokeWidth"] as? Double ?? 3.0
                
                let path = SVGPathParser.parse(d, scale: scale)
                
                context.stroke(
                    path,
                    with: .color(Color(hex: colorHex)),
                    style: StrokeStyle(lineWidth: CGFloat(strokeWidth) * scale, lineCap: .round, lineJoin: .round)
                )
            }
        }
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (255, 255, 255)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1
        )
    }
}

// MARK: - Widget View
struct ScribbleWidgetEntryView: View {
    var entry: ScribbleEntry
    @Environment(\.widgetFamily) var family
    
    private let sourceCanvasSize: CGFloat = 350
    
    // Very light off-white background for colored paths visibility
    private let backgroundColor = Color(hex: "FAFAFA")
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Light off-white background - edge to edge
                backgroundColor
                
                if entry.hasScribble {
                    // Real scribble - fills entire widget
                    ScribblePathView(paths: entry.paths, canvasSize: sourceCanvasSize)
                        .frame(width: geometry.size.width, height: geometry.size.height)
                } else {
                    // Placeholder heart doodle
                    ScribblePathView(paths: PlaceholderHeart.paths, canvasSize: sourceCanvasSize)
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .opacity(0.6)
                }
            }
        }
    }
}

// MARK: - Widget Configuration
@main
struct ScribbleWidget: Widget {
    let kind: String = "ScribbleWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScribbleProvider()) { entry in
            if #available(iOS 17.0, *) {
                ScribbleWidgetEntryView(entry: entry)
                    .containerBackground(.clear, for: .widget)
            } else {
                ScribbleWidgetEntryView(entry: entry)
                    .padding(-16)
            }
        }
        .configurationDisplayName("Partner's Scribble")
        .description("See doodles from your loved one")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Preview
struct ScribbleWidget_Previews: PreviewProvider {
    static var previews: some View {
        ScribbleWidgetEntryView(entry: ScribbleEntry(date: Date(), paths: [], senderName: "Emma", hasScribble: false))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}
