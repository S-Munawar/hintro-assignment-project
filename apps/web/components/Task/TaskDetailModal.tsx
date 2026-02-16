"use client";

import { useEffect, useState } from "react";
import { useTaskStore } from "@/store/useTaskStore";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import Modal from "@/components/Common/Modal";
import ActivityLog from "@/components/Activity/ActivityLog";
import Loader from "@/components/Common/Loader";
import {
  Trash2,
  UserPlus,
  UserMinus,
  Clock,
  FileText,
  Tag,
  ListTodo,
} from "lucide-react";
import type { TaskPriority } from "@/types";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

interface TaskDetailModalProps {
  boardId: string;
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDetailModal({ boardId, taskId, isOpen, onClose }: TaskDetailModalProps) {
  const { selectedTask, selectedTaskLoading, updateTask, deleteTask, assignUser, unassignUser } = useTaskStore();
  const { currentBoard } = useBoardStore();
  const { addToast } = useToastStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "activity">("details");

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title);
      setDescription(selectedTask.description ?? "");
      setPriority(selectedTask.priority);
      setDueDate(selectedTask.due_date ? selectedTask.due_date.split("T")[0]! : "");
    }
  }, [selectedTask]);

  const handleSave = async () => {
    if (!title.trim() || !selectedTask) return;
    setIsSaving(true);
    try {
      await updateTask(boardId, taskId, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
      });
      addToast("Task updated", "success");
    } catch {
      addToast("Failed to update task", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    try {
      await deleteTask(boardId, taskId);
      addToast("Task deleted", "success");
      onClose();
    } catch {
      addToast("Failed to delete task", "error");
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      await assignUser(boardId, taskId, userId);
      addToast("User assigned", "success");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to assign user", "error");
    }
  };

  const handleUnassign = async (userId: string) => {
    try {
      await unassignUser(boardId, taskId, userId);
      addToast("User unassigned", "success");
    } catch {
      addToast("Failed to unassign user", "error");
    }
  };

  const boardMembers = currentBoard
    ? [
        { id: currentBoard.owner.id, first_name: currentBoard.owner.first_name, last_name: currentBoard.owner.last_name, email: currentBoard.owner.email },
        ...currentBoard.members
          .filter((m) => m.user.id !== currentBoard.owner.id)
          .map((m) => ({
            id: m.user.id,
            first_name: m.user.first_name,
            last_name: m.user.last_name,
            email: m.user.email ?? "",
          })),
      ]
    : [];

  const assignedIds = new Set((selectedTask?.assignees ?? []).map((a) => a.user_id));
  const unassignedMembers = boardMembers.filter((m) => !assignedIds.has(m.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Details" size="lg">
      {selectedTaskLoading || !selectedTask ? (
        <div className="flex justify-center py-10">
          <Loader size="md" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "details"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="flex items-center gap-1.5"><FileText size={14} /> Details</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "activity"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="flex items-center gap-1.5"><Clock size={14} /> Activity</span>
            </button>
          </div>

          {activeTab === "details" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Main content */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description..."
                    rows={5}
                    className="input resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="input"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !title.trim()}
                    className="btn btn-primary"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2">
                        <span className="loader-spinner loader-sm border-white/30 border-t-white" />
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="btn btn-danger"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* List info */}
                <div className="card p-3 bg-slate-50 border-dashed">
                  <h4 className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest mb-1 flex items-center gap-1"><ListTodo size={11} /> List</h4>
                  <p className="text-sm font-medium text-slate-700">{selectedTask.list?.name ?? "—"}</p>
                </div>

                {/* Priority badge */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1"><Tag size={11} /> Priority</h4>
                  <span className={`priority-${selectedTask.priority}`}>
                    {selectedTask.priority}
                  </span>
                </div>

                {/* Created by */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest mb-1.5">Created by</h4>
                  <div className="flex items-center gap-2">
                    <div className="avatar avatar-xs bg-indigo-100 text-indigo-700">
                      {selectedTask.creator.first_name[0]}
                    </div>
                    <span className="text-sm text-slate-700">
                      {selectedTask.creator.first_name} {selectedTask.creator.last_name}
                    </span>
                  </div>
                </div>

                {/* Assignees */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest mb-2">Assignees</h4>
                  <div className="space-y-1.5">
                    {(selectedTask.assignees ?? []).filter((a, i, arr) => arr.findIndex((x) => x.user_id === a.user_id) === i).map((a) => (
                      <div key={a.id} className="flex items-center justify-between group/assignee">
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-xs bg-indigo-100 text-indigo-700">
                            {a.user.first_name[0]}
                          </div>
                          <span className="text-sm text-slate-700">
                            {a.user.first_name} {a.user.last_name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnassign(a.user_id)}
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover/assignee:opacity-100 transition-all"
                          title="Unassign"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    ))}

                    {unassignedMembers.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 tracking-wider uppercase mb-1">Add assignee</p>
                        {unassignedMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleAssign(m.id)}
                            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                          >
                            <UserPlus size={13} className="text-slate-400" />
                            {m.first_name} {m.last_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-100">
                  <p className="flex items-center gap-1.5">
                    <Clock size={11} /> Created {new Date(selectedTask.created_at).toLocaleDateString()}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Clock size={11} /> Updated {new Date(selectedTask.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ActivityLog boardId={boardId} taskId={taskId} />
          )}
        </div>
      )}
    </Modal>
  );
}
