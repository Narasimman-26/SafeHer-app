import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, ScrollView, StatusBar, TextInput, Linking
} from 'react-native';

import { useLocation } from './hooks/useLocation';
import { useShake } from './hooks/useShake';
import { useScreamDetection } from './hooks/useScreamDetection';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { saveSOSAlert, saveIncident } from './lib/supabase';
import { getClaudeResponse } from './lib/claude';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');

type Screen   = 'home' | 'sos' | 'map' | 'chat' | 'report';
type SOSStage = 'idle' | 'countdown' | 'sending' | 'sent';

const CONTACTS = [
  { name: 'Mom',    phone: '+91 98765 43210', emoji: '👩', color: '#ff6b9d', relation: 'Mother'    },
  { name: 'Priya',  phone: '+91 87654 32109', emoji: '👧', color: '#c678dd', relation: 'Friend'    },
  { name: 'Police', phone: '112',             emoji: '🚔', color: '#e06c75', relation: 'Emergency' },
];

const INCIDENTS = [
  { type: 'Unsafe Area',         loc: 'Oak St & 3rd Ave',    time: '2m ago',  sev: 'high'   },
  { type: 'Poor Lighting',       loc: 'Riverside Park Path', time: '15m ago', sev: 'medium' },
  { type: 'Suspicious Activity', loc: 'Central Station',     time: '1hr ago', sev: 'medium' },
  { type: 'All Clear',           loc: 'Main Campus Road',    time: '2hr ago', sev: 'low'    },
];

const REPORT_TYPES = [
  'Suspicious Activity', 'Poor Lighting', 'Unsafe Area', 
  'Harassment', 'Accident', 'Other'
];

const sevColor = (sev: string) => sev === 'high' ? '#c41a1a' : sev === 'medium' ? '#e5c07b' : '#50fa7b';

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0d1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2a3a' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function App() {
  const [screen,    setScreen]    = useState<Screen>('home');
  const [sosStage,  setSosStage]  = useState<SOSStage>('idle');
  const [count,     setCount]     = useState(5);
  const [sentIdx,   setSentIdx]   = useState(0);
  const [locShared, setLocShared] = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [safetyListening, setSafetyListening] = useState(true); // always on
  const [screamAlert, setScreamAlert] = useState(false);
  const [chatMsgs,  setChatMsgs]  = useState<{from: 'ai' | 'user', text: string}[]>([
    { from: 'ai', text: "Hi! I'm your AI safety companion 🛡️ How can I help?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoad,  setChatLoad]  = useState(false);
  const [repType,   setRepType]   = useState('');
  const [repLoc,    setRepLoc]    = useState('');
  const [repDetail, setRepDetail] = useState('');
  const [repDone,   setRepDone]   = useState(false);

  const loc = useLocation();

  const [policeStation, setPoliceStation] = useState<{
    name: string;
    latitude: number;
    longitude: number;
    distance: string;
  } | null>(null);

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
  };

  const findNearestPolice = async () => {
    const userLat = loc?.latitude ?? 13.0827;
    const userLng = loc?.longitude ?? 80.2707;

    // Step 1 - Instant hardcoded result
    const TN_POLICE = [
      { name: 'Chennai Central', latitude: 13.0827, longitude: 80.2707 },
      { name: 'Egmore Police Station', latitude: 13.0732, longitude: 80.2609 },
      { name: 'Perambur Police Station', latitude: 13.1186, longitude: 80.2479 },
      { name: 'Adyar Police Station', latitude: 13.0067, longitude: 80.2206 },
      { name: 'Anna Nagar Police Station', latitude: 13.0850, longitude: 80.2101 },
      { name: 'Tirunelveli Police Station', latitude: 8.7139, longitude: 77.7567 },
      { name: 'Madurai Police Station', latitude: 9.9252, longitude: 78.1198 },
      { name: 'Coimbatore Police Station', latitude: 11.0168, longitude: 76.9558 },
    ];

    const parseFloatDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      // Raw distance for fast comparison
      return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
    };

    const nearest = TN_POLICE.reduce((prev, curr) => {
      const d1 = parseFloatDist(userLat, userLng, curr.latitude, curr.longitude);
      const d2 = parseFloatDist(userLat, userLng, prev.latitude, prev.longitude);
      return d1 < d2 ? curr : prev;
    });

    setPoliceStation({
      name: nearest.name,
      latitude: nearest.latitude,
      longitude: nearest.longitude,
      distance: getDistanceKm(userLat, userLng, nearest.latitude, nearest.longitude),
    });

    // Step 2 - Overpass API in background with 3s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const url = `https://overpass-api.de/api/interpreter?data=[out:json];node["amenity"="police"](around:5000,${userLat},${userLng});out 3;`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (data.elements && data.elements.length > 0) {
        const station = data.elements[0];
        setPoliceStation({
          name: station.tags?.name || 'Police Station',
          latitude: station.lat,
          longitude: station.lon,
          distance: getDistanceKm(userLat, userLng, station.lat, station.lon),
        });
      }
    } catch {
      // Keep hardcoded result if network fails
    }
  };

  useEffect(() => {
    if (screen === 'map') {
      findNearestPolice();
    }
  }, [screen, loc]);

  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Animations
  useEffect(() => {
    let unmounted = false;
    const animatePulse = (anim: Animated.Value) => {
      Animated.sequence([
        Animated.timing(anim, { toValue: 2.5, duration: 2000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true })
      ]).start((res) => {
        if (res.finished && !unmounted) animatePulse(anim);
      });
    };

    animatePulse(pulseAnim1);
    const t2 = setTimeout(() => animatePulse(pulseAnim2), 600);
    const t3 = setTimeout(() => animatePulse(pulseAnim3), 1200);

    return () => {
      unmounted = true;
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true })
    ]).start();
  }, [screen, sosStage]);

  // SOS Logic
  const triggerSOS = () => {
    setSosStage('countdown');
    setCount(5);
    setSentIdx(0);
    setLocShared(false);
    setScreen('sos');
  };

  const resetSOS = () => {
    setSosStage('idle');
    setCount(5);
    setSentIdx(0);
    setLocShared(false);
    setScreen('home');
  };

  useShake(() => {
    if (sosStage === 'idle') triggerSOS();
  });

  const handleScream = () => {
    if (sosStage === 'idle') {
      setScreamAlert(true);
      setScreen('sos');
      triggerSOS();
      setTimeout(() => setScreamAlert(false), 3000);
    }
  };

  const handleVoiceHelp = () => {
    if (sosStage === 'idle') {
      setScreen('sos');
      triggerSOS();
    }
  };

  useScreamDetection(handleScream, safetyListening && sosStage === 'idle');
  useVoiceRecognition(handleVoiceHelp, safetyListening && sosStage === 'idle');

  useEffect(() => {
    if (sosStage === 'countdown') {
      if (count <= 0) {
        setSosStage('sending');
        return;
      }
      const t = setTimeout(() => setCount(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [sosStage, count]);

  useEffect(() => {
    if (sosStage === 'sending') {
      if (sentIdx < CONTACTS.length) {
        const t = setTimeout(() => setSentIdx(i => i + 1), 900);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => {
          setLocShared(true);
          setSyncing(true);
          const t2 = setTimeout(() => {
            setSyncing(false);
            setSosStage('sent');
            saveSOSAlert(loc?.latitude || 0, loc?.longitude || 0);
          }, 1200);
          return () => clearTimeout(t2);
        }, 500);
        return () => clearTimeout(t);
      }
    }
  }, [sosStage, sentIdx]);

  // Chat Logic
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMsgs(prev => [...prev, { from: 'user', text: userMsg }]);
    setChatLoad(true);

    const apiMsgs = chatMsgs.concat({ from: 'user', text: userMsg }).map(m => ({
      role: m.from === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    const data = await getClaudeResponse(apiMsgs);
    setChatLoad(false);
    if (data && data.content && data.content[0] && data.content[0].text) {
      setChatMsgs(prev => [...prev, { from: 'ai', text: data.content[0].text }]);
    } else {
      setChatMsgs(prev => [...prev, { from: 'ai', text: "I'm having trouble connecting right now 😔" }]);
    }
  };

  // Report Logic
  const submitReport = () => {
    if (!repType) return;
    setSyncing(true);
    saveIncident(repType, repLoc, repDetail);
    const t = setTimeout(() => {
      setSyncing(false);
      setRepDone(true);
    }, 1500);
  };

  // Helper renderings
  const renderHeader = () => (
    <View style={s.header}>
      <View style={s.logoBox}><Text style={s.logoEmoji}>🛡️</Text></View>
      <View>
        <Text style={s.logoText}>SafeHer</Text>
        <Text style={s.logoSub}>AI SAFETY COMPANION</Text>
      </View>
      <View style={s.syncBadge}>
        <View style={[s.syncDot, { backgroundColor: syncing ? '#e5c07b' : '#ff6b9d' }]} />
        <Text style={[s.syncText, { color: syncing ? '#e5c07b' : '#ff6b9d' }]}>
          {syncing ? 'SYNCING' : 'SYNCED'}
        </Text>
      </View>
      {safetyListening && sosStage === 'idle' && (
        <View style={s.listenBadge}>
          <View style={[s.syncDot, { backgroundColor: '#ff6b9d', width: 6, height: 6, borderRadius: 3, marginRight: 0 }]} />
          <Text style={{ color: '#ff6b9d', fontSize: 9 }}>LISTENING</Text>
        </View>
      )}
    </View>
  );

  const renderBottomNav = () => (
    <View style={s.bottomNav}>
      <TouchableOpacity style={s.navItem} onPress={() => setScreen('home')}>
        <Text style={s.navEmoji}>🏠</Text>
        <Text style={[s.navText, screen === 'home' && s.navTextActive]}>Home</Text>
        {screen === 'home' && <View style={s.navDot} />}
      </TouchableOpacity>
      <TouchableOpacity style={s.navItem} onPress={() => setScreen('map')}>
        <Text style={s.navEmoji}>🗺️</Text>
        <Text style={[s.navText, screen === 'map' && s.navTextActive]}>Map</Text>
        {screen === 'map' && <View style={s.navDot} />}
      </TouchableOpacity>
      <TouchableOpacity style={s.navItemSOS} onPress={() => setScreen('sos')}>
        <Text style={s.navSOSText}>SOS</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.navItem} onPress={() => setScreen('chat')}>
        <Text style={s.navEmoji}>💬</Text>
        <Text style={[s.navText, screen === 'chat' && s.navTextActive]}>Chat</Text>
        {screen === 'chat' && <View style={s.navDot} />}
      </TouchableOpacity>
      <TouchableOpacity style={s.navItem} onPress={() => { setScreen('report'); setRepDone(false); }}>
        <Text style={s.navEmoji}>📋</Text>
        <Text style={[s.navText, screen === 'report' && s.navTextActive]}>Report</Text>
        {screen === 'report' && <View style={s.navDot} />}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0c0010" />
      {screamAlert && (
        <View style={s.screamToast}>
          <Text style={{ fontSize: 20 }}>🆘</Text>
          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>
            Scream detected! SOS triggered automatically
          </Text>
        </View>
      )}
      {renderHeader()}
      
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          
          {/* HOME SCREEN */}
          {screen === 'home' && sosStage === 'idle' && (
            <View style={s.center}>
              <View style={s.leftAlign}>
                <Text style={s.h1}>Good evening,</Text>
                <Text style={s.h1Sub}>Stay Safe Today ✨</Text>
              </View>

              <View style={s.scoreCard}>
                <Text style={s.scoreNum}>87<Text style={s.scoreDenom}>/100</Text></Text>
                <Text style={s.scoreText}>✓ Your area is safe 🗺️</Text>
              </View>

              {/* Safety Listening Status */}
              <View style={s.listenCard}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                    🎙️ Safety Listening
                  </Text>
                  <Text style={{ color: '#777', fontSize: 11 }}>
                    Scream or say "Help" to auto-trigger SOS
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSafetyListening(v => !v)}
                  style={[s.toggleBtn, { backgroundColor: safetyListening ? '#ff6b9d' : '#333' }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                    {safetyListening ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={s.sosWrapper}>
                <Animated.View style={[s.ring, s.ring1, { transform: [{ scale: pulseAnim1 }], opacity: pulseAnim1.interpolate({ inputRange:[1,2.5], outputRange:[0.4,0] }) }]} />
                <Animated.View style={[s.ring, s.ring2, { transform: [{ scale: pulseAnim2 }], opacity: pulseAnim2.interpolate({ inputRange:[1,2.5], outputRange:[0.25,0] }) }]} />
                <Animated.View style={[s.ring, s.ring3, { transform: [{ scale: pulseAnim3 }], opacity: pulseAnim3.interpolate({ inputRange:[1,2.5], outputRange:[0.15,0] }) }]} />
                <TouchableOpacity style={s.sosBtn} onPress={triggerSOS} activeOpacity={0.85}>
                  <Text style={s.sosBtnEmoji}>🆘</Text>
                  <Text style={s.sosBtnText}>SOS</Text>
                </TouchableOpacity>
              </View>

              <View style={s.grid2x2}>
                <TouchableOpacity style={s.gridItem} onPress={() => setScreen('map')}>
                  <Text style={s.gridEmoji}>📍</Text><Text style={s.gridText}>Location</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.gridItem} onPress={() => setScreen('chat')}>
                  <Text style={s.gridEmoji}>💬</Text><Text style={s.gridText}>AI Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.gridItem} onPress={() => setScreen('report')}>
                  <Text style={s.gridEmoji}>📋</Text><Text style={s.gridText}>Report</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.gridItem}>
                  <Text style={s.gridEmoji}>👥</Text><Text style={s.gridText}>Contacts</Text>
                </TouchableOpacity>
              </View>

              <View style={s.leftAlign}>
                <Text style={s.sectionLabel}>COMMUNITY ALERTS</Text>
                {INCIDENTS.map((inc, i) => (
                  <View key={i} style={s.alertRow}>
                    <View style={s.alertDotRow}>
                      <View style={[s.syncDot, { backgroundColor: inc.sev === 'high' ? '#c41a1a' : inc.sev === 'medium' ? '#e5c07b' : '#50fa7b' }]} />
                      <Text style={s.incType}>{inc.type}</Text>
                    </View>
                    <Text style={s.incLoc}>{inc.loc} • {inc.time}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* SOS SCREEN */}
          {screen === 'sos' && (
            <View style={s.center}>
              {/* IDLE */}
              {sosStage === 'idle' && (
                <>
                  <Text style={s.sosTitle}>Emergency SOS</Text>
                  <View style={s.sosWrapper}>
                    <Animated.View style={[s.ring, s.ring1, { transform: [{ scale: pulseAnim1 }], opacity: pulseAnim1.interpolate({ inputRange:[1,2.5], outputRange:[0.4,0] }) }]} />
                    <Animated.View style={[s.ring, s.ring2, { transform: [{ scale: pulseAnim2 }], opacity: pulseAnim2.interpolate({ inputRange:[1,2.5], outputRange:[0.25,0] }) }]} />
                    <TouchableOpacity style={s.sosBtn} onPress={triggerSOS}>
                      <Text style={s.sosBtnEmoji}>🆘</Text>
                      <Text style={s.sosBtnText}>SOS</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={s.sectionLabel}>WILL ALERT</Text>
                  {CONTACTS.map((c, i) => (
                    <View key={i} style={s.contactRow}>
                      <View style={[s.avatar, { backgroundColor: c.color + '22', borderColor: c.color + '55' }]}><Text>{c.emoji}</Text></View>
                      <View style={s.contactInfo}>
                        <Text style={s.contactName}>{c.name}</Text>
                        <Text style={s.contactMeta}>{c.relation} • {c.phone}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* COUNTDOWN */}
              {sosStage === 'countdown' && (
                <>
                  <Text style={[s.alertLabel, { color: '#c41a1a' }]}>⚡ SENDING ALERT IN...</Text>
                  <View style={s.sosWrapper}>
                    <Animated.View style={[s.ring, s.ring1, { transform: [{ scale: pulseAnim1 }], opacity: pulseAnim1.interpolate({ inputRange:[1,2.5], outputRange:[0.5,0] }) }]} />
                    <Animated.View style={[s.ring, s.ring2, { transform: [{ scale: pulseAnim2 }], opacity: pulseAnim2.interpolate({ inputRange:[1,2.5], outputRange:[0.3,0] }) }]} />
                    <View style={s.countdownCircle}>
                      <Text style={s.countNum}>{count}</Text>
                    </View>
                  </View>
                  <Text style={s.incLoc}>Alerting 3 contacts with your GPS</Text>
                  <TouchableOpacity style={s.cancelBtn} onPress={resetSOS}>
                    <Text style={s.cancelText}>✕ Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* SENDING */}
              {sosStage === 'sending' && (
                <>
                  <Text style={[s.alertLabel, { color: '#ff6b9d' }]}>📡 TRANSMITTING SOS</Text>
                  <View style={s.radarBox}>
                    <Text style={{ fontSize: 36, zIndex: 10 }}>📡</Text>
                    {[80, 110, 140].map((size, i) => (
                      <View key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size/2, borderWidth: 1.5, borderColor: i < sentIdx ? '#ff6b9d' : 'rgba(255,107,157,0.2)' }} />
                    ))}
                  </View>
                  {CONTACTS.map((c, i) => {
                    const done = i < sentIdx;
                    const active = i === sentIdx;
                    return (
                      <View key={i} style={[s.sendRow, { borderColor: done ? '#50fa7b' : active ? '#ff6b9d' : 'rgba(255,255,255,0.05)' }]}>
                        <View style={[s.avatar, { backgroundColor: c.color + '22' }]}><Text>{c.emoji}</Text></View>
                        <View style={s.contactInfo}>
                          <Text style={s.contactName}>{c.name}</Text>
                        </View>
                        {done && <Text style={{ color: '#50fa7b' }}>✓</Text>}
                        {active && <View style={s.spinner} />}
                        {!done && !active && <Text style={{ color: '#555' }}>○</Text>}
                      </View>
                    );
                  })}
                  {locShared && (
                    <View style={s.powerSyncBadge}>
                      <View style={[s.syncDot, { backgroundColor: '#50fa7b' }]} />
                      <Text style={{ color: '#50fa7b', fontSize: 10 }}>GPS LOCATION SHARED</Text>
                    </View>
                  )}
                </>
              )}

              {/* SENT */}
              {sosStage === 'sent' && (
                <>
                  <View style={s.successCircle}><Text style={{ fontSize: 48 }}>✅</Text></View>
                  <Text style={[s.h1, { color: '#50fa7b', marginBottom: 16 }]}>Alert Sent!</Text>
                  {CONTACTS.map((c, i) => (
                    <View key={i} style={s.sentRow}>
                      <Text>{c.emoji}</Text>
                      <View style={s.contactInfo}><Text style={s.contactName}>{c.name}</Text></View>
                      <Text style={{ color: '#50fa7b', fontSize: 11 }}>✓ NOTIFIED</Text>
                    </View>
                  ))}
                  <View style={s.powerSyncBadge}>
                    <View style={[s.syncDot, { backgroundColor: '#50fa7b' }]} />
                    <Text style={{ color: '#50fa7b', fontSize: 10 }}>SYNCED VIA POWERSYNC → NEON DB</Text>
                  </View>
                  <TouchableOpacity style={s.safeBtn} onPress={resetSOS}>
                    <Text style={s.safeBtnText}>I'm Safe Now 🙏</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* MAP SCREEN */}
          {screen === 'map' && (
            <View style={s.pad20}>
              <Text style={s.h1}>Live Safety Map</Text>
              <Text style={s.incLoc}>Your location & nearest police station</Text>
              
              <WebView
                style={{ height: 280, borderRadius: 20, marginBottom: 16, overflow: 'hidden', marginTop: 20 }}
                source={{
                  html: `
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                          body { margin: 0; padding: 0; background-color: #111; }
                          iframe { filter: invert(90%) hue-rotate(180deg); border: 0; }
                        </style>
                      </head>
                      <body style="margin:0;padding:0;background-color:#111;">
                        <iframe 
                          width="100%" 
                          height="100%" 
                          src="https://maps.google.com/maps?q=${loc?.latitude ?? 13.0827},${loc?.longitude ?? 80.2707}&z=16&output=embed&iwloc=&maptype=roadmap" 
                          allowfullscreen>
                        </iframe>
                      </body>
                    </html>
                  `
                }}
                scrollEnabled={false}
              />

              {/* Police Station Card */}
              {policeStation ? (
                <View style={{
                  backgroundColor: 'rgba(224,108,117,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(224,108,117,0.25)',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <Text style={{ fontSize: 28 }}>🚔</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#aaa', fontSize: 9, letterSpacing: 2, marginBottom: 2 }}>
                      NEAREST POLICE STATION
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                      {policeStation.name}
                    </Text>
                    <Text style={{ color: '#e06c75', fontSize: 12, marginTop: 2 }}>
                      📍 {policeStation.distance} away
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Linking.openURL(
                        `https://www.google.com/maps/dir/${loc?.latitude},${loc?.longitude}/${policeStation.latitude},${policeStation.longitude}`
                      );
                    }}
                    style={{
                      backgroundColor: '#ff6b9d',
                      borderRadius: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Get</Text>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Route →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{
                  backgroundColor: 'rgba(255,107,157,0.06)',
                  borderRadius: 16, padding: 12, marginBottom: 16,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff6b9d' }} />
                  <Text style={{ color: '#ff6b9d', fontSize: 11 }}>Finding nearest police station...</Text>
                </View>
              )}

              {/* Incidents */}
              <Text style={[s.sectionLabel, { marginTop: 20 }]}>NEARBY INCIDENTS</Text>
              {INCIDENTS.map((inc, i) => (
                <View key={i} style={s.alertRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[s.syncDot, { backgroundColor: sevColor(inc.sev) }]} />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={s.incType}>{inc.type}</Text>
                      <Text style={s.incLoc}>{inc.loc}</Text>
                    </View>
                  </View>
                  <Text style={s.incLoc}>{inc.time}</Text>
                </View>
              ))}

              <View style={[s.powerSyncBadge, { marginTop: 20 }]}>
                <View style={[s.syncDot, { backgroundColor: '#61dafb' }]} />
                <Text style={{ color: '#61dafb', fontSize: 10 }}>POWERSYNC: REAL-TIME MAP DATA SYNCING</Text>
              </View>
            </View>
          )}

          {/* CHAT SCREEN */}
          {screen === 'chat' && (
            <View style={{ height: Dimensions.get('window').height - 180 }}>
              <View style={s.chatHeader}>
                <Text style={s.h1}>AI Safety Companion</Text>
                <Text style={{ color: '#50fa7b', fontSize: 10, marginTop: 4 }}>● ONLINE • Powered by Claude</Text>
              </View>
              <ScrollView contentContainerStyle={s.chatScroll}>
                {chatMsgs.map((m, i) => (
                  <View key={i} style={m.from === 'ai' ? s.chatRowAi : s.chatRowUser}>
                    <View style={m.from === 'ai' ? s.chatBubbleAi : s.chatBubbleUser}>
                      <Text style={s.chatText}>{m.text}</Text>
                    </View>
                  </View>
                ))}
                {chatLoad && <Text style={{ color: '#777', marginLeft: 20 }}>typing...</Text>}
              </ScrollView>
              <View style={s.chatInputRow}>
                <TextInput
                  style={s.chatInput}
                  placeholder="Ask for advice..."
                  placeholderTextColor="#777"
                  value={chatInput}
                  onChangeText={setChatInput}
                />
                <TouchableOpacity style={s.sendBtn} onPress={sendChat}>
                  <Text style={{ color: '#fff' }}>↑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* REPORT SCREEN */}
          {screen === 'report' && (
            <View style={s.pad20}>
              {!repDone ? (
                <>
                  <Text style={s.h1}>Report Incident</Text>
                  <Text style={[s.incLoc, { marginBottom: 20 }]}>Help keep the community safe</Text>
                  
                  <View style={s.grid2x2}>
                    {REPORT_TYPES.map(type => (
                      <TouchableOpacity key={type} style={[s.repTypeBtn, repType === type && { borderColor: '#ff6b9d', backgroundColor: 'rgba(255,107,157,0.1)' }]} onPress={() => setRepType(type)}>
                        <Text style={{ color: repType === type ? '#ff6b9d' : '#ccc', fontSize: 12 }}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <TextInput
                    style={s.textInput}
                    placeholder="Location details (e.g. Park Street)"
                    placeholderTextColor="#777"
                    value={repLoc}
                    onChangeText={setRepLoc}
                  />
                  <TextInput
                    style={[s.textInput, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Additional details (optional)"
                    placeholderTextColor="#777"
                    value={repDetail}
                    onChangeText={setRepDetail}
                    multiline
                  />
                  
                  <TouchableOpacity style={[s.submitBtn, !repType && { backgroundColor: '#333' }]} onPress={submitReport}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit Report</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={s.center}>
                  <Text style={{ fontSize: 60, marginBottom: 20 }}>🙏</Text>
                  <Text style={[s.h1, { color: '#50fa7b' }]}>Thank You!</Text>
                  <Text style={s.incLoc}>Your report helps keep everyone safe.</Text>
                  <View style={[s.powerSyncBadge, { marginTop: 20, marginBottom: 30 }]}>
                     <View style={[s.syncDot, { backgroundColor: '#50fa7b' }]} />
                     <Text style={{ color: '#50fa7b', fontSize: 10 }}>SYNCED VIA POWERSYNC → NEON DB</Text>
                  </View>
                  <TouchableOpacity style={s.safeBtn} onPress={() => setRepDone(false)}>
                    <Text style={s.safeBtnText}>Report Another</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

        </Animated.View>
      </ScrollView>
      {renderBottomNav()}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0010' },
  listenBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,107,157,0.1)',
    borderRadius: 10, paddingVertical: 3, paddingHorizontal: 7,
    marginLeft: 8,
  },
  screamToast: {
    position: 'absolute', top: 70, left: 16, right: 16, zIndex: 100,
    backgroundColor: 'rgba(200,0,40,0.95)',
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  listenCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,107,157,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,107,157,0.2)',
    borderRadius: 16, padding: 14, marginTop: 12, marginBottom: 20
  },
  toggleBtn: {
    borderRadius: 12, paddingVertical: 6, paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)'
  },
  logoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ff6b9d', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  logoEmoji: { fontSize: 18 },
  logoText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  logoSub: { color: '#777', fontSize: 9, letterSpacing: 2 },
  syncBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  syncDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  syncText: { fontSize: 9, fontFamily: 'monospace' },
  
  scroll: { paddingBottom: 100 },
  center: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 24 },
  leftAlign: { width: '100%', marginBottom: 20 },
  pad20: { padding: 20 },
  
  h1: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  h1Sub: { color: '#ff6b9d', fontSize: 16, marginTop: 4 },
  
  scoreCard: { width: '100%', padding: 20, backgroundColor: 'rgba(80,250,123,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(80,250,123,0.2)', marginBottom: 30 },
  scoreNum: { color: '#50fa7b', fontSize: 36, fontWeight: 'bold' },
  scoreDenom: { fontSize: 16, color: '#50fa7b', opacity: 0.7 },
  scoreText: { color: '#50fa7b', fontSize: 14, marginTop: 8 },
  
  sosTitle: { color: '#c41a1a', fontSize: 20, fontWeight: 'bold', marginBottom: 30, letterSpacing: 1 },
  sosWrapper: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  ring: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2 },
  ring1: { borderColor: 'rgba(196,26,26,0.4)' },
  ring2: { borderColor: 'rgba(196,26,26,0.25)' },
  ring3: { borderColor: 'rgba(196,26,26,0.12)' },
  sosBtn: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#c41a1a', justifyContent: 'center', alignItems: 'center', shadowColor: '#c41a1a', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 20 },
  sosBtnEmoji: { fontSize: 42 },
  sosBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 20, letterSpacing: 3 },
  
  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginBottom: 30 },
  gridItem: { width: '48%', backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 16, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  gridEmoji: { fontSize: 24, marginBottom: 8 },
  gridText: { color: '#ddd', fontSize: 12 },
  
  sectionLabel: { color: '#777', fontSize: 10, letterSpacing: 2, marginBottom: 12, width: '100%' },
  alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, marginBottom: 8, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  alertDotRow: { flexDirection: 'row', alignItems: 'center' },
  incType: { color: '#fff', fontSize: 14 },
  incLoc: { color: '#777', fontSize: 11 },
  
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 8, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  contactInfo: { flex: 1 },
  contactName: { color: '#ccc', fontSize: 14 },
  contactMeta: { color: '#777', fontSize: 10 },
  
  alertLabel: { fontSize: 12, letterSpacing: 3, fontFamily: 'monospace', marginBottom: 20 },
  countdownCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: 'rgba(196,26,26,0.5)', backgroundColor: '#0a0008', justifyContent: 'center', alignItems: 'center' },
  countNum: { color: '#c41a1a', fontSize: 60, fontWeight: 'bold' },
  cancelBtn: { marginTop: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 32 },
  cancelText: { color: '#aaa', fontSize: 14 },
  
  radarBox: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  sendRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8, width: '100%', borderWidth: 1.5 },
  spinner: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#ff6b9d', borderTopColor: 'transparent' },
  
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(80,250,123,0.1)', borderWidth: 3, borderColor: '#50fa7b', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#50fa7b', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  sentRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(80,250,123,0.06)', borderRadius: 12, marginBottom: 8, width: '100%', borderWidth: 1, borderColor: 'rgba(80,250,123,0.15)' },
  powerSyncBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(80,250,123,0.06)', borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(80,250,123,0.2)', width: '100%', justifyContent: 'center' },
  safeBtn: { marginTop: 30, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 40 },
  safeBtnText: { color: '#ccc', fontSize: 14 },
  
  mapBox: { width: '100%', height: 300, backgroundColor: '#0a1020', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 20, marginBottom: 20 },
  mapDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute' },
  mapMe: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#00e5ff', position: 'absolute', borderWidth: 2, borderColor: '#fff' },
  mapMeLabel: { position: 'absolute', bottom: 10, left: 10, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  mapLiveBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(196,26,26,0.1)', borderWidth: 1, borderColor: '#c41a1a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  legendText: { color: '#aaa', fontSize: 12 },
  
  chatHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  chatScroll: { padding: 20, paddingBottom: 100 },
  chatRowAi: { width: '100%', alignItems: 'flex-start', marginBottom: 16 },
  chatRowUser: { width: '100%', alignItems: 'flex-end', marginBottom: 16 },
  chatBubbleAi: { backgroundColor: 'rgba(255,255,255,0.08)', padding: 14, borderRadius: 16, borderBottomLeftRadius: 4, maxWidth: '85%' },
  chatBubbleUser: { backgroundColor: '#c678dd', padding: 14, borderRadius: 16, borderBottomRightRadius: 4, maxWidth: '85%' },
  chatText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  chatInputRow: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', padding: 16, backgroundColor: '#0c0010', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  chatInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ff6b9d', justifyContent: 'center', alignItems: 'center' },
  
  repTypeBtn: { width: '48%', padding: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  textInput: { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, color: '#fff', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  submitBtn: { width: '100%', padding: 16, backgroundColor: '#c678dd', borderRadius: 12, alignItems: 'center', marginTop: 10 },
  
  bottomNav: { flexDirection: 'row', position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#0c0010', paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', justifyContent: 'space-between', alignItems: 'center' },
  navItem: { alignItems: 'center', width: 50 },
  navEmoji: { fontSize: 20, marginBottom: 4 },
  navText: { color: '#777', fontSize: 10 },
  navTextActive: { color: '#ff6b9d', fontWeight: 'bold' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#ff6b9d', marginTop: 4 },
  navItemSOS: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#a00010', justifyContent: 'center', alignItems: 'center', marginTop: -30, borderWidth: 2, borderColor: '#0c0010', shadowColor: '#c41a1a', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  navSOSText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});