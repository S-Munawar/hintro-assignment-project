"use client";

import type { Task } from "@/types";
import { Calendar } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  /** When true the card is rendered inside DragOverlay — no sortable hook */
  isOverlay?: boolean;
}

export default function TaskCard({ task, onClick, isOverlay }: TaskCardProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const uniqueAssignees = (task.assignees ?? []).filter(
    (a, i, arr) => arr.findIndex((x) => x.user_id === a.user_id) === i,
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isOverlay });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => {
        // Prevent opening the detail modal while dragging
        if (isDragging) return;
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={`w-full text-left bg-white rounded-xl border border-slate-200/80 p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group ${
        isDragging ? "ring-2 ring-indigo-400 z-50" : ""
      } ${isOverlay ? "shadow-lg ring-2 ring-indigo-400 rotate-[2deg] scale-105" : ""}`}
    >
      <p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
        {task.title}
      </p>

      {task.description && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {/* Priority badge */}
        <span className={`priority-${task.priority}`}>
          {task.priority}
        </span>

        {/* Due date */}
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
            <Calendar size={11} />
            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}

        {/* Assignees */}
        {uniqueAssignees.length > 0 && (
          <div className="flex items-center -space-x-1.5 ml-auto">
            {uniqueAssignees.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="avatar avatar-xs bg-indigo-100 text-indigo-700 border-2 border-white"
                title={`${a.user.first_name} ${a.user.last_name}`}
              >
                {a.user.first_name[0]}
              </div>
            ))}
            {uniqueAssignees.length > 3 && (
              <span className="text-[10px] text-slate-400 ml-1.5">+{uniqueAssignees.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
