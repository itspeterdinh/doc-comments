import { useRef, useState, useEffect } from 'react';
import {
  loadFromCloud,
  saveToCloud,
  signInWithGoogle,
  signOutUser,
  onUserChange,
  appendHistory,
  loadHistory,
  clearHistory,
} from './firebase';
import { embed, cosine, pickBestTitle } from './openai';
import { transcribe } from './whisper';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getUserKey, setUserKey, testOpenAIKey, getScrollSpeed, setScrollSpeed, getMobilePopupMode, setMobilePopupMode } from './userKey';
import './App.css';

// Always work with reminder as an array of variants.
// Tolerates legacy data where reminder was a single string.
function getVariants(ann) {
  if (Array.isArray(ann.reminder)) return ann.reminder.filter(Boolean);
  if (typeof ann.reminder === 'string' && ann.reminder.trim())
    return [ann.reminder];
  return [];
}

function primaryReminder(ann) {
  return getVariants(ann)[0] || '(untitled)';
}

// True for actual touch devices (phones/tablets), false for desktops — even when the
// desktop window is narrowed. Detected via primary input device, not viewport width.
function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
}

function showAnswer(annotation, winRef, openMobileModal) {
  if (isMobileViewport()) {
    openMobileModal(annotation);
    return;
  }
  openAnswerWindow(annotation, winRef);
}

function MobileAnswerModal({ annotation, onClose }) {
  const [ttsState, setTtsState] = useState('idle');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    return () => window.speechSynthesis && window.speechSynthesis.cancel();
  }, []);

  function toggleSpeak() {
    const synth = window.speechSynthesis;
    if (!synth) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }
    if (synth.speaking && !synth.paused) {
      synth.pause();
      setTtsState('paused');
      return;
    }
    if (synth.paused) {
      synth.resume();
      setTtsState('speaking');
      return;
    }
    synth.cancel();
    const text = (primaryReminder(annotation) + '. ' + (annotation.answer || '')).trim();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => setTtsState('idle');
    utter.onerror = () => setTtsState('idle');
    synth.speak(utter);
    setTtsState('speaking');
  }

  if (!annotation) return null;
  const ttsLabel = ttsState === 'speaking' ? '⏸' : ttsState === 'paused' ? '▶' : '🔊';
  const ttsTitle = ttsState === 'speaking' ? 'Pause' : ttsState === 'paused' ? 'Resume' : 'Read aloud';
  return (
    <div className="answer-modal-backdrop" onClick={onClose}>
      <div className="answer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="answer-modal-header">
          <h2>{primaryReminder(annotation)}</h2>
          <div className="answer-modal-actions">
            <button className="answer-modal-close" onClick={toggleSpeak} title={ttsTitle}>
              {ttsLabel}
            </button>
            <button className="answer-modal-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>
        <div className="answer-modal-body">
          {(annotation.answer || '').split('\n').map((line, i) => (
            <p key={i}>{line || ' '}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function openAnswerWindow(annotation, winRef) {
  if (winRef.current && !winRef.current.closed) {
    winRef.current.close();
  }
  const mobileMode = getMobilePopupMode();
  const defaultW = mobileMode ? 414 : 680;
  const defaultH = mobileMode ? 812 : 520;
  const saved = JSON.parse(localStorage.getItem('answerWindowPos') || '{}');
  const left =
    saved.left ?? Math.round(window.screenX + (window.outerWidth - defaultW) / 2);
  const top =
    saved.top ?? Math.round(window.screenY + (window.outerHeight - defaultH) / 2);
  const w = window.open(
    '',
    '_blank',
    `width=${defaultW},height=${defaultH},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
  if (!w) return;
  winRef.current = w;
  const body = annotation.answer.replace(/\n/g, '<br>');
  const title = primaryReminder(annotation);
  const scrollSpeed = getScrollSpeed();
  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #14141f; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #e4e4ec;
      padding: 28px 32px 40px;
    }
    h2 {
      font-size: 1rem;
      font-weight: 700;
      color: #f0f0f8;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 2px solid #2a2a3e;
      line-height: 1.4;
    }
    p {
      font-size: 0.85rem;
      line-height: 1.85;
      color: #d4d4e4;
    }
    ::selection {
      background: #7c6af7;
      color: #fff;
    }
  </style>
  <script>
    window.addEventListener("load", function() {
      const mobileMode = ${mobileMode};
      const saved = JSON.parse(window.opener && window.opener.localStorage.getItem("answerWindowPos") || "{}");
      // In mobile-preview mode: lock to phone dimensions (ignore saved size & don't auto-fit).
      if (mobileMode) {
        window.resizeTo(${defaultW}, ${defaultH});
      } else if (saved.width != null && saved.height != null) {
        window.resizeTo(saved.width, saved.height);
      } else {
        const body = document.body;
        const w = Math.min(Math.max(body.scrollWidth  + 64, 400), 900);
        const h = Math.min(Math.max(body.scrollHeight + 48, 200), 800);
        window.resizeTo(w, h);
      }
      if (saved.left != null && saved.top != null) {
        window.moveTo(saved.left, saved.top);
      }
    });
    window.addEventListener("beforeunload", function() {
      window.opener && window.opener.localStorage.setItem(
        "answerWindowPos",
        JSON.stringify({
          left: window.screenX,
          top: window.screenY,
          width: window.outerWidth,
          height: window.outerHeight,
        })
      );
    });
    window.addEventListener("keydown", function(e) {
      if (e.key === "Escape") window.close();
    });
    // Click anywhere to toggle smooth auto-scroll from top to bottom.
    let autoScrollId = null;
    document.addEventListener("click", function() {
      if (autoScrollId) {
        cancelAnimationFrame(autoScrollId);
        autoScrollId = null;
        return;
      }
      const PIXELS_PER_SEC = ${scrollSpeed}; // from user settings
      let lastT = performance.now();
      let pos = window.scrollY; // float; accumulates sub-pixel progress
      const step = (t) => {
        const dt = (t - lastT) / 1000;
        lastT = t;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        pos += PIXELS_PER_SEC * dt;
        if (pos >= max) {
          window.scrollTo({ top: max });
          autoScrollId = null;
          return;
        }
        window.scrollTo({ top: pos });
        autoScrollId = requestAnimationFrame(step);
      };
      // Start from current position (top by default)
      autoScrollId = requestAnimationFrame(step);
    });
    // Text-to-speech toggle
    function ttsToggle(btn) {
      const synth = window.speechSynthesis;
      if (!synth) { alert('Speech synthesis not supported.'); return; }
      if (synth.speaking && !synth.paused) {
        synth.pause();
        btn.textContent = '▶';
        return;
      }
      if (synth.paused) {
        synth.resume();
        btn.textContent = '⏸';
        return;
      }
      synth.cancel();
      const heading = document.querySelector('h2')?.innerText || '';
      const body = document.querySelector('p')?.innerText || '';
      const utter = new SpeechSynthesisUtterance(heading + '. ' + body);
      utter.rate = 1;
      utter.pitch = 1;
      utter.onend = () => { btn.textContent = '🔊'; };
      utter.onerror = () => { btn.textContent = '🔊'; };
      synth.speak(utter);
      btn.textContent = '⏸';
    }
    window.addEventListener('beforeunload', function() {
      window.speechSynthesis && window.speechSynthesis.cancel();
    });
  </script>
  <style>
    .tts-btn {
      position: fixed; top: 14px; right: 14px;
      width: 36px; height: 36px; border-radius: 50%;
      background: #232336; color: #e4e4ec;
      border: 1px solid #3a3a55;
      font-size: 1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      z-index: 100;
    }
    .tts-btn:hover { background: #2e2e46; border-color: #7c6af7; }
  </style>
</head>
<body>
  <button class="tts-btn" title="Read aloud" onclick="ttsToggle(this)">🔊</button>
  <h2>${title}</h2>
  <p>${body}</p>
</body>
</html>`);
  w.document.close();
}

function SidebarItem({ ann, index, onOpen }) {
  return (
    <li className="sidebar-item" onClick={() => onOpen(ann)}>
      <span className="sidebar-index">{index}</span>
      <span className="sidebar-reminder">{primaryReminder(ann)}</span>
    </li>
  );
}

function DashboardRow({ ann, onToggle, onEdit, onDelete, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ann.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? '#f0f0ff' : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={ann.enabled ? '' : 'row-disabled'}
    >
      <td className="cell-drag">
        <span className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </span>
      </td>
      <td>
        <label className="switch">
          <input
            type="checkbox"
            checked={ann.enabled}
            onChange={() => onToggle(ann.id)}
          />
          <span className="slider"></span>
        </label>
      </td>
      <td className="cell-reminder">{primaryReminder(ann)}</td>
      <td className="cell-actions">
        <button
          className="dash-btn"
          onClick={() => onOpen(ann)}
        >
          View
        </button>
        <button className="dash-btn" onClick={() => onEdit(ann)}>
          Edit
        </button>
        <button className="dash-btn danger" onClick={() => onDelete(ann.id)}>
          Delete
        </button>
      </td>
    </tr>
  );
}

function EditorModal({ initial, onSave, onClose }) {
  const initialVariants = initial ? getVariants(initial).join('\n') : '';
  const [reminder, setReminder] = useState(initialVariants);
  const [answer, setAnswer] = useState(initial?.answer || '');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSave() {
    const variants = reminder
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (variants.length === 0) return;
    onSave({ reminder: variants, answer });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? 'Edit annotation' : 'New annotation'}</h3>
        <label>
          Reminder / question variants (one per line)
          <textarea
            rows={5}
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            placeholder={
              'Tell me about a time you failed\nDescribe a mistake you made\nShare a setback you faced'
            }
            autoFocus
          />
        </label>
        <label>
          Answer
          <textarea
            rows={14}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }) {
  const [key, setKey] = useState(getUserKey());
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }
  const [speed, setSpeed] = useState(getScrollSpeed());

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    const result = await testOpenAIKey(key);
    setTestResult(result);
    setTesting(false);
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function save() {
    setUserKey(key);
    setScrollSpeed(speed);
    onClose();
  }
  function clear() {
    setUserKey('');
    setKey('');
  }

  const masked = key
    ? key.length > 11
      ? key.slice(0, 7) + '…' + key.slice(-4)
      : '••••••'
    : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>
        <label>
          Your OpenAI API key
          <input
            type={reveal ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="settings-hint">
          Stored only in this browser (<code>localStorage</code>). It is sent
          directly from your browser to OpenAI — never to our server.
          {key && (
            <div style={{ marginTop: 6 }}>
              Currently saved: <code>{masked}</code>
            </div>
          )}
        </div>
        <label>
          Answer popup auto-scroll speed
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 80, fontSize: '0.8rem', color: '#aaa' }}>
              {speed} px/sec
            </span>
          </div>
        </label>
        <div
          className="modal-actions"
          style={{ justifyContent: 'space-between' }}
        >
          <div>
            <button onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide' : 'Reveal'}
            </button>
            {getUserKey() && (
              <button
                className="danger"
                onClick={clear}
                style={{ marginLeft: 6 }}
              >
                Clear saved key
              </button>
            )}
            <button
              onClick={runTest}
              disabled={testing || !key.trim()}
              style={{ marginLeft: 6 }}
            >
              {testing ? 'Testing…' : 'Test key'}
            </button>
            {testResult && (
              <span
                className={`key-test ${testResult.ok ? 'key-test--ok' : 'key-test--bad'}`}
                title={testResult.message || ''}
              >
                {testResult.ok ? '✓ Key works' : `✕ ${testResult.message}`}
              </span>
            )}
          </div>
          <div>
            <button onClick={onClose}>Cancel</button>
            <button
              className="primary"
              onClick={save}
              style={{ marginLeft: 6 }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const winRef = useRef(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [mobileAnswer, setMobileAnswer] = useState(null);
  const [mobilePopup, setMobilePopup] = useState(getMobilePopupMode());
  const showAnswerFn = (ann) => showAnswer(ann, winRef, setMobileAnswer);

  function togglePopupSize() {
    const next = !mobilePopup;
    setMobilePopupMode(next);
    setMobilePopup(next);
  }
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 768;
  });

  useEffect(() => {
    return onUserChange((u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        // Signed out — clear local data
        setAnnotations([]);
        setLoaded(false);
      }
    });
  }, []);
  const [editing, setEditing] = useState(null); // null | { ann } | { ann: null } for new
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function openHistory() {
    if (!user) return;
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const list = await loadHistory(user.uid);
      setHistory(list);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function clearAllHistory() {
    if (!user) return;
    if (!confirm('Clear all call history?')) return;
    await clearHistory(user.uid);
    setHistory([]);
  }
  const [hasUserKey, setHasUserKey] = useState(!!getUserKey());

  function closeSettings() {
    setShowSettings(false);
    setHasUserKey(!!getUserKey());
  }
  const [search, setSearch] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [queryEmbedding, setQueryEmbedding] = useState(null);
  const [embedding, setEmbedding] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState({
    pending: 0,
    total: 0,
    justFinished: false,
    error: null,
  });

  // Auto-hide the "up to date" pill 5s after it appears
  useEffect(() => {
    if (!embeddingStatus.justFinished) return;
    const t = setTimeout(
      () => setEmbeddingStatus((s) => ({ ...s, justFinished: false })),
      5000,
    );
    return () => clearTimeout(t);
  }, [embeddingStatus.justFinished]);

  async function openTopSemanticMatch(query, { source } = {}) {
    const items = annotations.filter((a) => a.enabled);
    if (items.length === 0) return null;
    try {
      const titles = items.map((a) => getVariants(a).join(' | '));
      const idx = await pickBestTitle(query, titles);
      const target = items[idx];
      console.log('Voice query:', query, '→', titles[idx]);
      if (target) {
        showAnswer(target, winRef, setMobileAnswer);
        setSearch('');
        setSelectedSearchIndex(0);
        // Persist to history if this came from a call recording
        if (source === 'call' && user) {
          appendHistory(user.uid, {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            transcript: query,
            matchedId: target.id,
            matchedReminder: primaryReminder(target),
          }).catch((e) => console.error('History save failed:', e));
        }
      }
      return target;
    } catch (e) {
      console.error('Voice match failed:', e);
      return null;
    }
  }

  const finalTranscriptRef = useRef('');
  const [callConnected, setCallConnected] = useState(false);
  const [callListening, setCallListening] = useState(false);
  const callStreamRef = useRef(null);
  const callActiveRef = useRef(false);
  const toggleCallRecordingRef = useRef(() => {});

  async function connectCallTab() {
    if (callConnected) {
      // Disconnect
      callActiveRef.current = false;
      callStreamRef.current?.getTracks().forEach((t) => t.stop());
      callStreamRef.current = null;
      setCallConnected(false);
      setCallListening(false);
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } catch (e) {
      console.error('Tab share canceled or failed:', e);
      return;
    }
    if (stream.getAudioTracks().length === 0) {
      alert(
        'No audio in shared stream. Re-share the tab and tick "Share tab audio".',
      );
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    callStreamRef.current = stream;
    setCallConnected(true);

    const cleanup = () => {
      callActiveRef.current = false;
      callStreamRef.current = null;
      setCallConnected(false);
      setCallListening(false);
    };
    stream.getVideoTracks()[0]?.addEventListener('ended', cleanup);
    stream.getAudioTracks()[0]?.addEventListener('ended', cleanup);
  }

  const sessionBufferRef = useRef([]);

  function toggleCallRecording() {
    if (!callConnected || !callStreamRef.current) return;

    if (callListening) {
      callActiveRef.current = false;
      setCallListening(false);
      // On stop, run search on the accumulated session text
      const fullText = sessionBufferRef.current.join(' ').trim();
      sessionBufferRef.current = [];
      if (fullText) {
        console.log('🔎 Running search on full session:', fullText);
        setSearch(fullText);
        openTopSemanticMatch(fullText, { source: 'call' });
      }
      return;
    }

    sessionBufferRef.current = [];
    const audioStream = new MediaStream(callStreamRef.current.getAudioTracks());
    callActiveRef.current = true;
    setCallListening(true);

    const CHUNK_MS = 6000;
    const startCycle = () => {
      if (!callActiveRef.current) return;
      const chunks = [];
      const recorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm',
      });
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = async () => {
        if (callActiveRef.current) startCycle();
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const text = await transcribe(blob);
          if (!text) return;

          // Filter out noise / nonsense chunks
          const cleaned = text.trim();
          const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
          const hasLetters = /[a-zA-Z]/.test(cleaned);
          const MIN_WORDS = 4;
          const MIN_CHARS = 15;
          // Common Whisper hallucinations on silence / music
          const HALLUCINATIONS = [
            'thank you',
            'thanks for watching',
            'thanks for listening',
            'you',
            '.',
            'bye',
            'okay',
            'ok',
          ];
          const isHallucination = HALLUCINATIONS.includes(
            cleaned.toLowerCase().replace(/[.!?]/g, '').trim(),
          );

          if (
            !hasLetters ||
            wordCount < MIN_WORDS ||
            cleaned.length < MIN_CHARS ||
            isHallucination
          ) {
            console.log('🔇 Skipped (too short / noise):', cleaned);
            return;
          }

          console.log('🎧 Call chunk:', cleaned);
          sessionBufferRef.current.push(cleaned);
        } catch (e) {
          console.error('Transcription failed:', e);
        }
      };
      recorder.start();
      setTimeout(
        () => recorder.state !== 'inactive' && recorder.stop(),
        CHUNK_MS,
      );
    };
    startCycle();
  }

  function toggleListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    finalTranscriptRef.current = '';
    const recog = new SpeechRecognition();
    recog.lang = 'en-US';
    recog.interimResults = true;
    recog.continuous = true; // keep listening until our silence timer stops it

    const SILENCE_MS = 1000;
    let silenceTimer = null;
    const resetSilenceTimer = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => recog.stop(), SILENCE_MS);
    };

    recog.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('');
      finalTranscriptRef.current = transcript;
      setSearch(transcript);
      setSelectedSearchIndex(0);
      resetSilenceTimer();
    };
    recog.onend = () => {
      clearTimeout(silenceTimer);
      setListening(false);
      const q = finalTranscriptRef.current.trim();
      if (q) openTopSemanticMatch(q);
    };
    recog.onerror = () => {
      clearTimeout(silenceTimer);
      setListening(false);
    };
    recognitionRef.current = recog;
    recog.start();
    setListening(true);
    resetSilenceTimer(); // start the timer immediately in case nothing is said
  }

  // Load this user's annotations whenever they sign in / change
  useEffect(() => {
    if (!user) return;
    loadFromCloud(user.uid)
      .then((record) => {
        const isValid =
          record &&
          Array.isArray(record) &&
          record.length > 0 &&
          record[0]?.reminder;
        setAnnotations(isValid ? record : []);
        setLoaded(true);
      })
      .catch((err) => {
        console.error(err);
        setAnnotations([]);
        setLoaded(true);
      });
  }, [user]);

  // Keep the ref pointing at the latest toggle function — no stale closures.
  toggleCallRecordingRef.current = toggleCallRecording;

  // Keyboard shortcuts: Alt+R or Ctrl/Cmd+Z toggles call recording (only when a tab is connected)
  useEffect(() => {
    const onKey = (e) => {
      const isAltR =
        e.altKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR');
      const isCtrlZ =
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ');
      if (!isAltR && !isCtrlZ) return;
      e.preventDefault();
      toggleCallRecordingRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Save to cloud (debounced) whenever annotations change after initial load
  useEffect(() => {
    if (!loaded || !user) return;
    const t = setTimeout(() => {
      saveToCloud(user.uid, annotations).catch(console.error);
    }, 500);
    return () => clearTimeout(t);
  }, [annotations, loaded, user]);

  // Generate embeddings for any annotations missing a current-version embedding.
  // Bump EMBED_VERSION when changing what we embed (e.g. title-only → title+answer).
  useEffect(() => {
    if (!loaded) return;
    // Skip silently if no OpenAI key — semantic search just falls back to substring.
    if (!getUserKey() && !import.meta.env.VITE_OPENAI_API_KEY) return;
    const EMBED_VERSION = 3;
    const missing = annotations.filter(
      (a) =>
        getVariants(a).length > 0 &&
        (!a.embedding || a.embeddingVersion !== EMBED_VERSION),
    );
    if (missing.length === 0) {
      if (embeddingStatus.pending > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEmbeddingStatus({
          pending: 0,
          total: 0,
          justFinished: true,
          error: null,
        });
        console.log('✅ All embeddings up to date');
      }
      return;
    }
    setEmbeddingStatus((s) => ({
      pending: missing.length,
      total: Math.max(s.total, missing.length),
      justFinished: false,
      error: null,
    }));
    console.log(`🔄 Regenerating ${missing.length} embedding(s)…`);
    (async () => {
      for (let i = 0; i < missing.length; i++) {
        const ann = missing[i];
        try {
          // Embed only the reminder/question variants, not the answer
          const text = getVariants(ann).join('\n');
          const vec = await embed(text);
          setAnnotations((prev) =>
            prev.map((a) =>
              a.id === ann.id
                ? { ...a, embedding: vec, embeddingVersion: EMBED_VERSION }
                : a,
            ),
          );
          setEmbeddingStatus((s) => ({
            ...s,
            pending: Math.max(0, s.pending - 1),
          }));
          console.log('  ✓ Embedded:', primaryReminder(ann));
          // Small pacing delay to stay under rate limits
          if (i < missing.length - 1) {
            await new Promise((r) => setTimeout(r, 120));
          }
        } catch (e) {
          console.error('Embed failed for', primaryReminder(ann), e);
          setEmbeddingStatus({
            pending: 0,
            total: 0,
            justFinished: false,
            error: e.message,
          });
          break; // stop on first error (likely missing key/quota)
        }
      }
    })();
  }, [loaded, annotations]);

  // Debounced semantic embedding of the query (only fires for non-empty search)
  useEffect(() => {
    if (!search.trim()) return;
    // Skip silently if no OpenAI key — substring fallback handles search.
    if (!getUserKey() && !import.meta.env.VITE_OPENAI_API_KEY) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmbedding(true);
    const t = setTimeout(async () => {
      try {
        const vec = await embed(search);
        setQueryEmbedding(vec);
      } catch (e) {
        console.error(e);
        setQueryEmbedding(null);
      } finally {
        setEmbedding(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const visible = annotations.filter((ann) => ann.enabled);
  const sensors = useSensors(useSensor(PointerSensor));

  let searchMatches = [];
  if (search.trim()) {
    if (queryEmbedding) {
      // Semantic ranking — only over enabled (shown) items
      searchMatches = annotations
        .filter((a) => a.enabled && a.embedding)
        .map((a) => ({ ann: a, score: cosine(queryEmbedding, a.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((x) => x.ann);
    } else {
      // Fallback: substring while embedding is still computing
      const q = search.toLowerCase();
      searchMatches = annotations.filter(
        (a) =>
          a.enabled && getVariants(a).some((r) => r.toLowerCase().includes(q)),
      );
    }
  }

  function handleSearchKey(e) {
    if (searchMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex((i) => (i + 1) % searchMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(
        (i) => (i - 1 + searchMatches.length) % searchMatches.length,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = searchMatches[selectedSearchIndex];
      if (target) {
        showAnswer(target, winRef, setMobileAnswer);
        setSearch('');
        setSelectedSearchIndex(0);
      }
    } else if (e.key === 'Escape') {
      setSearch('');
      setSelectedSearchIndex(0);
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setAnnotations((prev) => {
      const oldIndex = prev.findIndex((a) => a.id === active.id);
      const newIndex = prev.findIndex((a) => a.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function toggleEnabled(id) {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
  }

  function deleteAnnotation(id) {
    if (!confirm('Delete this annotation?')) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }

  function saveEdit(data) {
    if (editing?.ann) {
      // edit existing
      setAnnotations((prev) =>
        prev.map((a) => (a.id === editing.ann.id ? { ...a, ...data } : a)),
      );
    } else {
      // create new
      setAnnotations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          enabled: true,
          reminder: data.reminder,
          answer: data.answer,
        },
      ]);
    }
    setEditing(null);
  }

  // Auth gate
  if (!authReady) {
    return (
      <div className="signin-screen">
        <div>Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="signin-screen">
        <div className="signin-card">
          <h1>Interview Assistant</h1>
          <p>Sign in with Google to access your questions and answers.</p>
          <button
            className="signin-btn"
            onClick={() => signInWithGoogle().catch((e) => alert(e.message))}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`layout ${sidebarOpen ? 'layout--sidebar-open' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <span>Interview Questions</span>
          <div className="user-chip" title={user.email || user.displayName}>
            {user.photoURL && <img src={user.photoURL} alt="" />}
            <button
              className="signout-link"
              onClick={() => signOutUser()}
              title="Sign out"
            >
              ⎋
            </button>
          </div>
        </div>
        <ul className="sidebar-list" onClick={() => isMobileViewport() && setSidebarOpen(false)}>
          {visible.map((ann, index) => (
            <SidebarItem key={ann.id} ann={ann} index={index} onOpen={showAnswerFn} />
          ))}
        </ul>
      </aside>

      <main className="main">
        <div className="dashboard">
          {!hasUserKey && !import.meta.env.VITE_OPENAI_API_KEY && (
            <div className="key-banner">
              <span>
                ⚠️ No OpenAI key configured. Voice & semantic search won't work
                until you add your own key.
              </span>
              <button onClick={() => setShowSettings(true)}>Add key</button>
            </div>
          )}
          <div className="dashboard-header">
            <h2>Dashboard</h2>
            <div className="dashboard-meta">
              <span>
                {visible.length} shown · {annotations.length} total
              </span>
              {embeddingStatus.pending > 0 ? (
                <span className="embed-status embed-status--working">
                  🔄 Updating embeddings…{' '}
                  {embeddingStatus.total - embeddingStatus.pending}/
                  {embeddingStatus.total}
                </span>
              ) : embeddingStatus.error ? (
                <span
                  className="embed-status embed-status--error"
                  title={embeddingStatus.error}
                >
                  ⚠️ Embedding error
                  <button
                    className="embed-retry"
                    onClick={() =>
                      setEmbeddingStatus({
                        pending: 0,
                        total: 0,
                        justFinished: false,
                        error: null,
                      })
                    }
                  >
                    Retry
                  </button>
                </span>
              ) : embeddingStatus.justFinished ? (
                <span className="embed-status embed-status--ok">
                  ✓ Embeddings up to date
                </span>
              ) : null}
              <button
                className="add-btn-lg"
                onClick={() => setEditing({ ann: null })}
              >
                + New
              </button>
              <button
                className={`settings-btn ${mobilePopup ? 'settings-btn--on' : ''}`}
                title={mobilePopup ? 'Mobile popup size: ON' : 'Open popup at phone size'}
                onClick={togglePopupSize}
              >
                📱
              </button>
              <button
                className="settings-btn"
                title="Call history"
                onClick={openHistory}
              >
                🕒
              </button>
              <button
                className="settings-btn"
                title="Settings"
                onClick={() => setShowSettings(true)}
              >
                ⚙
              </button>
            </div>
          </div>
          <div className="search-bar">
            <div className="search-row">
              <input
                type="text"
                className="search-input"
                placeholder={
                  embedding
                    ? 'Thinking…'
                    : 'Search by meaning or keyword… (↑↓ navigate, Enter to open)'
                }
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearch(v);
                  setSelectedSearchIndex(0);
                  if (!v.trim()) setQueryEmbedding(null);
                }}
                onKeyDown={handleSearchKey}
                autoFocus
              />
              <button
                className={`mic-btn ${listening ? 'listening' : ''}`}
                title={listening ? 'Stop listening' : 'Start voice search'}
                onClick={toggleListening}
              >
                {listening ? '🛑' : '🎤'}
              </button>
              <button
                className={`mic-btn ${callConnected ? 'connected' : ''}`}
                title={
                  callConnected
                    ? 'Disconnect tab'
                    : 'Connect to Teams tab (share with audio)'
                }
                onClick={connectCallTab}
              >
                {callConnected ? '🔗' : '➕'}
              </button>
            </div>
            {searchMatches.length > 0 && (
              <ul className="search-results">
                {searchMatches.map((ann, i) => (
                  <li
                    key={ann.id}
                    className={
                      i === selectedSearchIndex
                        ? 'search-hit selected'
                        : 'search-hit'
                    }
                    onMouseEnter={() => setSelectedSearchIndex(i)}
                    onClick={() => {
                      showAnswer(ann, winRef, setMobileAnswer);
                      setSearch('');
                      setSelectedSearchIndex(0);
                    }}
                  >
                    {primaryReminder(ann)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!loaded ? (
            <div className="main-hint">Loading…</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Show</th>
                    <th>Reminder</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext
                    items={[
                      ...annotations.filter((a) => a.enabled),
                      ...annotations.filter((a) => !a.enabled),
                    ].map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {[
                      ...annotations.filter((a) => a.enabled),
                      ...annotations.filter((a) => !a.enabled),
                    ].map((ann) => (
                      <DashboardRow
                        key={ann.id}
                        ann={ann}
                        onToggle={toggleEnabled}
                        onEdit={(a) => setEditing({ ann: a })}
                        onDelete={deleteAnnotation}
                        onOpen={showAnswerFn}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          )}
        </div>
      </main>

      {editing && (
        <EditorModal
          initial={editing.ann}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {showSettings && <SettingsModal onClose={closeSettings} />}

      {mobileAnswer && (
        <MobileAnswerModal
          annotation={mobileAnswer}
          onClose={() => setMobileAnswer(null)}
        />
      )}

      {showHistory && (
        <div className="modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h3>Call history</h3>
            {historyLoading ? (
              <div className="settings-hint">Loading…</div>
            ) : history.length === 0 ? (
              <div className="settings-hint">
                No history yet. When you stop a call recording, the transcript
                and matched question will appear here.
              </div>
            ) : (
              <ul className="history-list">
                {history.map((h) => (
                  <li key={h.id} className="history-item">
                    <div className="history-meta">
                      {new Date(h.timestamp).toLocaleString()}
                    </div>
                    <div className="history-match">
                      → <strong>{h.matchedReminder || '(no match)'}</strong>
                    </div>
                    <div className="history-transcript">{h.transcript}</div>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              {history.length > 0 ? (
                <button className="danger" onClick={clearAllHistory}>
                  Clear all
                </button>
              ) : <span />}
              <button onClick={() => setShowHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {callConnected && (
        <button
          className={`floating-record ${callListening ? 'listening' : ''}`}
          title={
            callListening
              ? 'Stop transcribing (Alt+R or Ctrl+Z)'
              : 'Start transcribing call (Alt+R or Ctrl+Z)'
          }
          onClick={toggleCallRecording}
        >
          {callListening ? '🛑' : '🎧'}
        </button>
      )}
    </div>
  );
}
