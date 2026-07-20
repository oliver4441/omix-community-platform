import { useState, useCallback, useEffect, useRef } from 'react';

interface CallParticipant {
  id: string;
  displayName: string;
  email?: string;
  avatar?: string;
  isLocal: boolean;
  muted: boolean;
  videoEnabled: boolean;
}

interface UseJitsiCallReturn {
  participants: CallParticipant[];
  localParticipant: CallParticipant | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  joinCall: (callId: string, displayName: string, options?: { audioOnly?: boolean }) => Promise<void>;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  sendMessage: (text: string) => void;
  chatMessages: { sender: string; text: string; timestamp: Date }[];
}

// JAAS (Jitsi as a Service) configuration for 8x8.vc
const JAAS_APP_ID = 'vpaas-magic-cookie-f82e22b3fd5a4307b8febe201da2aa04';
const JAAS_DOMAIN = '8x8.vc';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export function useJitsiCall(): UseJitsiCallReturn {
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<CallParticipant | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; timestamp: Date }[]>([]);
  
  const apiRef = useRef<any>(null);
  const callIdRef = useRef<string>('');
  const displayNameRef = useRef<string>('');
  const scriptLoadedRef = useRef(false);

  // Dynamically load the Jitsi external API script
  const loadJitsiScript = useCallback((): Promise<void> => {
    if (scriptLoadedRef.current && window.JitsiMeetExternalAPI) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://${JAAS_DOMAIN}/${JAAS_APP_ID}/external_api.js`;
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Jitsi API script'));
      document.head.appendChild(script);
    });
  }, []);

  const cleanup = useCallback(() => {
    if (apiRef.current) {
      try {
        apiRef.current.dispose();
      } catch (e) {
        console.warn('Error disposing Jitsi API:', e);
      }
      apiRef.current = null;
    }
    setParticipants([]);
    setLocalParticipant(null);
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const joinCall = useCallback(async (callId: string, displayName: string, options?: { audioOnly?: boolean }) => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    setError(null);
    callIdRef.current = callId;
    displayNameRef.current = displayName;

    try {
      // Load the Jitsi script first
      await loadJitsiScript();
      
      const roomName = `${JAAS_APP_ID}/${callId}`;
      
      const api = new window.JitsiMeetExternalAPI(JAAS_DOMAIN, {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: document.getElementById('jitsi-container') || document.body,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: options?.audioOnly || false,
          prejoinPageEnabled: false,
          requireDisplayName: true,
          enableClosePage: false,
          enableUserRolesBasedOnToken: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: '',
          DEFAULT_BACKGROUND: '#18191c',
          VERTICAL_FILMSTRIP: true,
          FILM_STRIP_MAX_HEIGHT: 120,
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security'
          ],
        },
        userInfo: {
          displayName,
        },
        onload: () => {
          console.log('Jitsi API loaded');
        },
      });

      apiRef.current = api;

      // Event listeners
      api.on('videoConferenceJoined', (data: any) => {
        console.log('Joined conference:', data);
        setIsConnected(true);
        setIsConnecting(false);
        
        const localId = api.getMyUserId();
        setLocalParticipant({
          id: localId,
          displayName,
          isLocal: true,
          muted: false,
          videoEnabled: !options?.audioOnly,
        });
      });

      api.on('videoConferenceLeft', () => {
        console.log('Left conference');
        cleanup();
      });

      api.on('conferenceFailed', (data: any) => {
        console.error('Conference failed:', data);
        setError(data.error || 'Failed to join call');
        setIsConnecting(false);
        cleanup();
      });

      api.on('participantJoined', (data: any) => {
        console.log('Participant joined:', data);
        setParticipants(prev => {
          if (prev.some(p => p.id === data.id)) return prev;
          return [...prev, {
            id: data.id,
            displayName: data.displayName || 'Unknown',
            isLocal: false,
            muted: false,
            videoEnabled: true,
          }];
        });
      });

      api.on('participantLeft', (data: any) => {
        console.log('Participant left:', data);
        setParticipants(prev => prev.filter(p => p.id !== data.id));
      });

      api.on('audioMuteStatusChanged', (data: any) => {
        setParticipants(prev => prev.map(p => 
          p.id === data.id ? { ...p, muted: data.muted } : p
        ));
        if (data.id === apiRef.current?.getMyUserId()) {
          setLocalParticipant(prev => prev ? { ...prev, muted: data.muted } : null);
        }
      });

      api.on('videoMuteStatusChanged', (data: any) => {
        setParticipants(prev => prev.map(p => 
          p.id === data.id ? { ...p, videoEnabled: !data.muted } : p
        ));
        if (data.id === apiRef.current?.getMyUserId()) {
          setLocalParticipant(prev => prev ? { ...prev, videoEnabled: !data.muted } : null);
        }
      });

      api.on('chatMessageReceived', (data: any) => {
        setChatMessages(prev => [...prev, {
          sender: data.senderName || 'Unknown',
          text: data.message,
          timestamp: new Date(),
        }]);
      });

    } catch (err) {
      console.error('Error joining call:', err);
      setError(err instanceof Error ? err.message : 'Failed to join call');
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, cleanup, loadJitsiScript]);

  const leaveCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (apiRef.current) {
      const muted = apiRef.current.isAudioMuted();
      apiRef.current.executeCommand('toggleAudio');
      setLocalParticipant(prev => prev ? { ...prev, muted: !muted } : null);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (apiRef.current) {
      const videoMuted = apiRef.current.isVideoMuted();
      apiRef.current.executeCommand('toggleVideo');
      setLocalParticipant(prev => prev ? { ...prev, videoEnabled: !videoMuted } : null);
    }
  }, []);

  const toggleScreenShare = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleShareScreen');
    }
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (apiRef.current && text.trim()) {
      apiRef.current.sendTextMessage(text.trim());
      setChatMessages(prev => [...prev, {
        sender: 'You',
        text: text.trim(),
        timestamp: new Date(),
      }]);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    participants,
    localParticipant,
    isConnected,
    isConnecting,
    error,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    sendMessage,
    chatMessages,
  };
}