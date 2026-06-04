import { useRef, useState } from 'react';
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
import { annotations as initialAnnotations } from './data';
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

function SortableItem({ ann, index, winRef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ann.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="sidebar-item"
      onClick={() => openAnswerWindow(ann, winRef)}
    >
      <span
        className="drag-handle"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </span>
      <span className="sidebar-index">{index}</span>
      <span className="sidebar-reminder">{ann.reminder}</span>
    </li>
  );
}

export default function App() {
  const winRef = useRef(null);
  const [annotations, setAnnotations] = useState(initialAnnotations);

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

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">Interview Questions</div>
        <ul className="sidebar-list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visible.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {visible.map((ann, index) => (
                <SortableItem
                  key={ann.id}
                  ann={ann}
                  index={index}
                  winRef={winRef}
                />
              ))}
            </SortableContext>
          </DndContext>
        </ul>
      </aside>

      <main className="main">
        <div className="main-hint">
          Select a question from the left to open its answer in a new window.
        </div>
      </main>
    </div>
  );
}
