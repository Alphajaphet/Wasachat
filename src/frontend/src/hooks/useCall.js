import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket } from '../lib/socket';
import api from '../lib/api';

export function useCall(currentUserId) {
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('audio');
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteUserId(null);
    setIncomingCall(null);
    pendingCandidatesRef.current = [];
  }, []);

  const getIceServers = useCallback(async () => {
    try {
      const { data } = await api.get('/calls/ice-servers');
      return data.iceServers;
    } catch (err) {
      console.error('Failed to fetch ICE servers, falling back to public STUN', err);
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId, iceServers) => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket()?.emit('call:ice-candidate', {
          recipientId: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setCallState((prev) => (prev === 'connected' ? 'ended' : prev));
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  const startCall = useCallback(async (targetUserId, type = 'audio') => {
    setCallType(type);
    setRemoteUserId(targetUserId);
    setCallState('calling');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
    localStreamRef.current = stream;
    setLocalStream(stream);

    const iceServers = await getIceServers();
    const pc = createPeerConnection(targetUserId, iceServers);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    getSocket()?.emit('call:invite', { recipientId: targetUserId, callType: type });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    getSocket()?.emit('call:offer', { recipientId: targetUserId, offer });
  }, [getIceServers, createPeerConnection]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { callerId, callType: type, offer } = incomingCall;

    setCallType(type);
    setRemoteUserId(callerId);
    setCallState('connected');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
    localStreamRef.current = stream;
    setLocalStream(stream);

    const iceServers = await getIceServers();
    const pc = createPeerConnection(callerId, iceServers);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    if (offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit('call:answer', { recipientId: callerId, answer });
    }
    setIncomingCall(null);
  }, [incomingCall, getIceServers, createPeerConnection]);

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      getSocket()?.emit('call:reject', { recipientId: incomingCall.callerId });
    }
    setIncomingCall(null);
    setCallState('idle');
  }, [incomingCall]);

  const endCall = useCallback(() => {
    if (remoteUserId) {
      getSocket()?.emit('call:end', { recipientId: remoteUserId });
    }
    cleanup();
    setCallState('idle');
  }, [remoteUserId, cleanup]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onInvite({ callerId, callType: type }) {
      setIncomingCall({ callerId, callType: type, offer: null });
      setCallState('ringing');
    }

    function onOffer({ callerId, offer }) {
      setIncomingCall((prev) => prev ? { ...prev, offer } : { callerId, callType: 'audio', offer });
    }

    async function onAnswer({ answer }) {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('connected');
    }

    async function onIceCandidate({ candidate }) {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }

    function onReject() {
      cleanup();
      setCallState('idle');
    }

    function onEnd() {
      cleanup();
      setCallState('ended');
      setTimeout(() => setCallState('idle'), 1500);
    }

    socket.on('call:invite', onInvite);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:reject', onReject);
    socket.on('call:end', onEnd);

    return () => {
      socket.off('call:invite', onInvite);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:reject', onReject);
      socket.off('call:end', onEnd);
    };
  }, [cleanup]);

  return {
    callState,
    callType,
    remoteUserId,
    localStream,
    remoteStream,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}