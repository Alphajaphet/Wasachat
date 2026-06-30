import { useEffect, useRef } from 'react';

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function CallOverlay({ callState, callType, incomingCall, contactName, localStream, remoteStream, onAccept, onReject, onEnd }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, callType]);

  if (callState === 'idle') return null;

  if (callState === 'ringing' && incomingCall) {
    return (
      <div className="call-overlay">
        <div className="call-incoming">
          <div className="call-avatar-large">{initials(contactName)}</div>
          <div className="call-contact-name">{contactName}</div>
          <div className="call-status-text">Incoming {incomingCall.callType} call…</div>
          <div className="call-actions">
            <button className="call-btn call-btn-reject" onClick={onReject}>
              <span>✕</span>
            </button>
            <button className="call-btn call-btn-accept" onClick={onAccept}>
              <span>✓</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="call-overlay">
      {callType === 'video' && callState === 'connected' ? (
        <div className="call-video-stage">
          <video ref={remoteVideoRef} autoPlay playsInline className="call-video-remote" />
          <video ref={localVideoRef} autoPlay playsInline muted className="call-video-local" />
        </div>
      ) : (
        <div className="call-incoming">
          <div className="call-avatar-large">{initials(contactName)}</div>
          <div className="call-contact-name">{contactName}</div>
          <div className="call-status-text">
            {callState === 'calling' && 'Calling…'}
            {callState === 'connected' && (callType === 'video' ? 'Connecting video…' : 'On call')}
            {callState === 'ended' && 'Call ended'}
          </div>
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay />

      {callState !== 'ended' && (
        <div className="call-actions call-actions-bottom">
          <button className="call-btn call-btn-reject" onClick={onEnd}>
            <span>✕</span>
          </button>
        </div>
      )}
    </div>
  );
}