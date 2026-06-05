import { useRef, useState, useEffect } from 'react';
import { loadFromCloud, saveToCloud } from './firebase';
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
import './App.css';

function openAnswerWindow(annotation, winRef) {
  if (winRef.current && !winRef.current.closed) {
    winRef.current.close();
  }
  const saved = JSON.parse(localStorage.getItem('answerWindowPos') || '{}');
  const left =
    saved.left ?? Math.round(window.screenX + (window.outerWidth - 680) / 2);
  const top =
    saved.top ?? Math.round(window.screenY + (window.outerHeight - 520) / 2);
  const w = window.open(
    '',
    '_blank',
    `width=680,height=520,left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
  if (!w) return;
  winRef.current = w;
  const body = annotation.answer.replace(/\n/g, '<br>');
  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${annotation.reminder}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #fff;
      color: #1a1a1a;
      padding: 28px 32px 40px;
    }
    h2 {
      font-size: 1rem;
      font-weight: 700;
      color: #111;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e8e8e8;
      line-height: 1.4;
    }
    p {
      font-size: 0.85rem;
      line-height: 1.85;
      color: #222;
    }
  </style>
  <script>
    window.addEventListener("load", function() {
      const body = document.body;
      const w = Math.min(Math.max(body.scrollWidth  + 64, 400), 900);
      const h = Math.min(Math.max(body.scrollHeight + 48, 200), 800);
      const saved = JSON.parse(window.opener && window.opener.localStorage.getItem("answerWindowPos") || "{}");
      window.resizeTo(w, h);
      if (saved.left != null && saved.top != null) {
        window.moveTo(saved.left, saved.top);
      }
    });
    window.addEventListener("beforeunload", function() {
      window.opener && window.opener.localStorage.setItem(
        "answerWindowPos",
        JSON.stringify({ left: window.screenX, top: window.screenY })
      );
    });
    window.addEventListener("keydown", function(e) {
      if (e.key === "Escape") window.close();
    });
  </script>
</head>
<body>
  <h2>${annotation.reminder}</h2>
  <p>${body}</p>
</body>
</html>`);
  w.document.close();
}

function SidebarItem({ ann, index, winRef }) {
  return (
    <li className="sidebar-item" onClick={() => openAnswerWindow(ann, winRef)}>
      <span className="sidebar-index">{index}</span>
      <span className="sidebar-reminder">{ann.reminder}</span>
    </li>
  );
}

function DashboardRow({ ann, onToggle, onEdit, onDelete, winRef }) {
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
      <td className="cell-reminder">{ann.reminder}</td>
      <td className="cell-answer">
        {ann.answer.length > 120 ? ann.answer.slice(0, 120) + '…' : ann.answer}
      </td>
      <td className="cell-actions">
        <button
          className="dash-btn"
          onClick={() => openAnswerWindow(ann, winRef)}
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
  const [reminder, setReminder] = useState(initial?.reminder || '');
  const [answer, setAnswer] = useState(initial?.answer || '');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSave() {
    if (!reminder.trim()) return;
    onSave({ reminder: reminder.trim(), answer });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? 'Edit annotation' : 'New annotation'}</h3>
        <label>
          Reminder (title)
          <input
            type="text"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
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

export default function App() {
  const winRef = useRef(null);
  const [annotations, setAnnotations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null); // null | { ann } | { ann: null } for new
  const [search, setSearch] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [queryEmbedding, setQueryEmbedding] = useState(null);
  const [embedding, setEmbedding] = useState(false);

  async function openTopSemanticMatch(query) {
    const items = annotations.filter((a) => a.enabled);
    if (items.length === 0) return;
    try {
      const titles = items.map((a) => a.reminder);
      const idx = await pickBestTitle(query, titles);
      console.log('Voice query:', query, '→', titles[idx]);
      const target = items[idx];
      if (target) {
        openAnswerWindow(target, winRef);
        setSearch('');
        setSelectedSearchIndex(0);
      }
    } catch (e) {
      console.error('Voice match failed:', e);
    }
  }

  const finalTranscriptRef = useRef('');
  const [callConnected, setCallConnected] = useState(false);
  const [callListening, setCallListening] = useState(false);
  const callStreamRef = useRef(null);
  const callActiveRef = useRef(false);

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

  function toggleCallRecording() {
    if (!callConnected || !callStreamRef.current) return;

    if (callListening) {
      callActiveRef.current = false;
      setCallListening(false);
      return;
    }

    const audioStream = new MediaStream(
      callStreamRef.current.getAudioTracks(),
    );
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
          console.log('🎧 Call chunk:', text);
          setSearch(text);
          openTopSemanticMatch(text);
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

    const SILENCE_MS = 7000;
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

  // Load from cloud on mount; seed from data.js if cloud is empty
  useEffect(() => {
    loadFromCloud()
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
  }, []);

  // Save to cloud (debounced) whenever annotations change after initial load
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      saveToCloud(annotations).catch(console.error);
    }, 500);
    return () => clearTimeout(t);
  }, [annotations, loaded]);

  // Generate embeddings for any annotations missing a current-version embedding.
  // Bump EMBED_VERSION when changing what we embed (e.g. title-only → title+answer).
  useEffect(() => {
    if (!loaded) return;
    const EMBED_VERSION = 2;
    const missing = annotations.filter(
      (a) => !a.embedding || a.embeddingVersion !== EMBED_VERSION,
    );
    if (missing.length === 0) return;
    (async () => {
      for (const ann of missing) {
        try {
          const text = `${ann.reminder}\n\n${ann.answer}`;
          const vec = await embed(text);
          setAnnotations((prev) =>
            prev.map((a) =>
              a.id === ann.id
                ? { ...a, embedding: vec, embeddingVersion: EMBED_VERSION }
                : a,
            ),
          );
        } catch (e) {
          console.error('Embed failed for', ann.reminder, e);
          break; // stop on first error (likely missing key/quota)
        }
      }
    })();
  }, [loaded, annotations]);

  // Debounced semantic embedding of the query (only fires for non-empty search)
  useEffect(() => {
    if (!search.trim()) return;
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
      // Semantic ranking
      searchMatches = annotations
        .filter((a) => a.embedding)
        .map((a) => ({ ann: a, score: cosine(queryEmbedding, a.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((x) => x.ann);
    } else {
      // Fallback: substring while embedding is still computing
      searchMatches = annotations.filter((a) =>
        a.reminder.toLowerCase().includes(search.toLowerCase()),
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
        openAnswerWindow(target, winRef);
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

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>Interview Questions</span>
        </div>
        <ul className="sidebar-list">
          {visible.map((ann, index) => (
            <SidebarItem key={ann.id} ann={ann} index={index} winRef={winRef} />
          ))}
        </ul>
      </aside>

      <main className="main">
        <div className="dashboard">
          <div className="dashboard-header">
            <h2>Dashboard</h2>
            <div className="dashboard-meta">
              <span>
                {visible.length} shown · {annotations.length} total
              </span>
              <button
                className="add-btn-lg"
                onClick={() => setEditing({ ann: null })}
              >
                + New
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
              <button
                className={`mic-btn ${callListening ? 'listening' : ''}`}
                title={
                  !callConnected
                    ? 'Connect a tab first'
                    : callListening
                      ? 'Stop transcribing'
                      : 'Start transcribing call'
                }
                onClick={toggleCallRecording}
                disabled={!callConnected}
              >
                {callListening ? '🛑' : '🎧'}
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
                      openAnswerWindow(ann, winRef);
                      setSearch('');
                      setSelectedSearchIndex(0);
                    }}
                  >
                    {ann.reminder}
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
                    <th>Answer preview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext
                    items={annotations.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {annotations.map((ann) => (
                      <DashboardRow
                        key={ann.id}
                        ann={ann}
                        onToggle={toggleEnabled}
                        onEdit={(a) => setEditing({ ann: a })}
                        onDelete={deleteAnnotation}
                        winRef={winRef}
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
    </div>
  );
}
