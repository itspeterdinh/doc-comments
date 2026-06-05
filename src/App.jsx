import { useRef, useState, useEffect } from 'react';
import { loadFromCloud, saveToCloud } from './jsonbin';
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
import { annotations as seedAnnotations } from './data';
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
    <li
      className="sidebar-item"
      onClick={() => openAnswerWindow(ann, winRef)}
    >
      <span className="sidebar-index">{index}</span>
      <span className="sidebar-reminder">{ann.reminder}</span>
    </li>
  );
}

function DashboardRow({ ann, onToggle, onEdit, onDelete, winRef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ann.id });

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
        <span
          className="drag-handle"
          {...attributes}
          {...listeners}
        >
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
        {ann.answer.length > 120
          ? ann.answer.slice(0, 120) + '…'
          : ann.answer}
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
        <button
          className="dash-btn danger"
          onClick={() => onDelete(ann.id)}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function EditorModal({ initial, onSave, onClose }) {
  const [reminder, setReminder] = useState(initial?.reminder || '');
  const [answer, setAnswer] = useState(initial?.answer || '');

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

  // Load from cloud on mount; seed from data.js if cloud is empty
  useEffect(() => {
    loadFromCloud()
      .then((record) => {
        const isValid =
          record &&
          Array.isArray(record) &&
          record.length > 0 &&
          record[0]?.reminder;
        if (isValid) {
          setAnnotations(record);
        } else {
          setAnnotations(seedAnnotations);
        }
        setLoaded(true);
      })
      .catch((err) => {
        console.error(err);
        setAnnotations(seedAnnotations);
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

  const visible = annotations.filter((ann) => ann.enabled);
  const sensors = useSensors(useSensor(PointerSensor));

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
            <SidebarItem
              key={ann.id}
              ann={ann}
              index={index}
              winRef={winRef}
            />
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
          {!loaded ? (
            <div className="main-hint">Loading…</div>
          ) : (
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
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
                </DndContext>
              </tbody>
            </table>
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
