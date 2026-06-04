import { useState, useRef, useEffect } from "react";
import { annotations } from "./data";

function Popup({ annotation, anchor, onClose }) {
  const popupRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target) && !anchor?.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchor]);

  if (!annotation || !anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const top = rect.bottom + 8;
  const left = Math.min(rect.left, window.innerWidth - 360);

  return (
    <div
      ref={popupRef}
      style={{ top, left }}
      className="popup"
    >
      <div className="popup-header">
        <span className="popup-label">"{annotation.reminder}"</span>
        <button className="popup-close" onClick={onClose}>✕</button>
      </div>
      <p className="popup-body">{annotation.answer}</p>
    </div>
  );
}

function buildSegments(text, annotations) {
  const sorted = [...annotations].sort((a, b) => {
    const ia = text.toLowerCase().indexOf(a.reminder.toLowerCase());
    const ib = text.toLowerCase().indexOf(b.reminder.toLowerCase());
    return ia - ib;
  });

  const segments = [];
  let cursor = 0;
  const lower = text.toLowerCase();

  for (const ann of sorted) {
    const idx = lower.indexOf(ann.reminder.toLowerCase(), cursor);
    if (idx === -1) continue;
    if (idx > cursor) segments.push({ type: "text", content: text.slice(cursor, idx) });
    segments.push({ type: "highlight", content: text.slice(idx, idx + ann.reminder.length), annotation: ann });
    cursor = idx + ann.reminder.length;
  }

  if (cursor < text.length) segments.push({ type: "text", content: text.slice(cursor) });
  return segments;
}

export default function AnnotatedText({ text }) {
  const [active, setActive] = useState(null); // { annotation, el }
  const segments = buildSegments(text, annotations);

  function handleClick(e, annotation) {
    if (active?.annotation.id === annotation.id) {
      setActive(null);
    } else {
      setActive({ annotation, el: e.currentTarget });
    }
  }

  return (
    <>
      <p className="document-text">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <span key={i}>{seg.content}</span>
          ) : (
            <mark
              key={i}
              className={`highlight ${active?.annotation.id === seg.annotation.id ? "highlight--active" : ""}`}
              onClick={(e) => handleClick(e, seg.annotation)}
              title="Click to see full explanation"
            >
              {seg.content}
            </mark>
          )
        )}
      </p>

      {active && (
        <Popup
          annotation={active.annotation}
          anchor={active.el}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
