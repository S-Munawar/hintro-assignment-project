"use client";

import { useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import { MoreHorizontal, Trash2, Edit3 } from "lucide-react";
import type { ListWithTasks } from "@/types";
import TaskCard from "@/components/Task/TaskCard";
import CreateTaskForm from "@/components/Task/CreateTaskForm";

interface ListColumnProps {
  list: ListWithTasks;
  boardId: string;
  onTaskClick: (taskId: string) => void;
}

export default function ListColumn({ list, boardId, onTaskClick }: ListColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [showMenu, setShowMenu] = useState(false);
  const { updateList, deleteList } = useBoardStore();
  const { addToast } = useToastStore();

  const handleRename = async () => {
    if (!name.trim() || name.trim() === list.name) {
      setName(list.name);
      setIsEditing(false);
      return;
    }
    try {
      await updateList(boardId, list.id, { name: name.trim() });
      setIsEditing(false);
    } catch {
      addToast("Failed to rename list", "error");
      setName(list.name);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${list.name}"? All tasks in this list will be removed.`)) return;
    try {
      await deleteList(boardId, list.id);
      addToast("List deleted", "success");
    } catch {
      addToast("Failed to delete list", "error");
    }
  };

  return (
    <div className="kanban-column">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        {isEditing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") { setName(list.name); setIsEditing(false); }
            }}
            className="text-sm font-semibold text-slate-900 border-b border-indigo-500 outline-none bg-transparent flex-1 mr-2"
            autoFocus
          />
        ) : (
          <h3 className="text-sm font-semibold text-slate-700 truncate flex-1">
            {list.name}
            <span className="ml-2 text-[11px] font-medium text-slate-400 bg-slate-200/60 rounded-full px-1.5 py-0.5">{list.tasks.length}</span>
          </h3>
        )}

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 rounded-md transition-colors"
            type="button"
          >
            <MoreHorizontal size={16} />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="dropdown-menu right-0 mt-1 z-20">
                <button
                  onClick={() => { setIsEditing(true); setShowMenu(false); }}
                  className="dropdown-item"
                  type="button"
                >
                  <Edit3 size={13} /> Rename
                </button>
                <button
                  onClick={() => { handleDelete(); setShowMenu(false); }}
                  className="dropdown-item-danger"
                  type="button"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[60px]" data-list-id={list.id}>
        {list.tasks
          .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
          .map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
          ))}
      </div>

      {/* Add task */}
      <div className="px-2 pb-2">
        <CreateTaskForm boardId={boardId} listId={list.id} />
      </div>
    </div>
  );
}
