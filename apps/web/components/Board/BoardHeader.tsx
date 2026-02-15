"use client";

import { useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Edit3, Users, ArrowLeft, LayoutList, CheckSquare, UserPlus } from "lucide-react";
import Link from "next/link";
import BoardMembersModal from "@/components/Board/BoardMembersModal";
import type { BoardDetail } from "@/types";

interface BoardHeaderProps {
  board: BoardDetail;
}

export default function BoardHeader({ board }: BoardHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(board.name);
  const [showMenu, setShowMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const { updateBoard, deleteBoard } = useBoardStore();
  const { addToast } = useToastStore();
  const router = useRouter();

  const handleRename = async () => {
    if (!name.trim() || name.trim() === board.name) {
      setName(board.name);
      setIsEditing(false);
      return;
    }
    try {
      await updateBoard(board.id, { name: name.trim() });
      setIsEditing(false);
      addToast("Board renamed", "success");
    } catch {
      addToast("Failed to rename board", "error");
      setName(board.name);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this board? All lists and tasks will be removed.")) return;
    try {
      await deleteBoard(board.id);
      addToast("Board deleted", "success");
      router.push("/");
    } catch {
      addToast("Failed to delete board", "error");
    }
  };

  const totalTasks = board.lists.reduce((n, l) => n + l.tasks.length, 0);

  return (
    <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>

        <div
          className="w-2.5 h-2.5 rounded-[3px] shrink-0 ring-1 ring-black/5"
          style={{ backgroundColor: board.color }}
        />

        {isEditing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setName(board.name);
                setIsEditing(false);
              }
            }}
            className="text-lg font-bold text-slate-900 border-b-2 border-indigo-500 outline-none bg-transparent"
            autoFocus
          />
        ) : (
          <h1
            onClick={() => setIsEditing(true)}
            className="text-lg font-bold text-slate-900 truncate cursor-pointer hover:text-indigo-600 transition-colors"
          >
            {board.name}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Stats */}
        <div className="hidden sm:flex items-center gap-1 mr-2">
          <span className="badge flex items-center gap-1"><LayoutList size={12} />{board.lists.length}</span>
          <span className="badge flex items-center gap-1"><CheckSquare size={12} />{totalTasks}</span>
          <button
            type="button"
            onClick={() => setShowMembers(true)}
            className="badge flex items-center gap-1 cursor-pointer hover:bg-slate-200 transition-colors"
          >
            <Users size={12} />{board.members.length + 1}
          </button>
        </div>

        {/* Add Member button */}
        <button
          type="button"
          onClick={() => setShowMembers(true)}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Manage members"
        >
          <UserPlus size={18} />
        </button>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            type="button"
          >
            <MoreHorizontal size={18} />
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
                  <Edit3 size={14} /> Rename Board
                </button>
                <button
                  onClick={() => { setShowMembers(true); setShowMenu(false); }}
                  className="dropdown-item"
                  type="button"
                >
                  <Users size={14} /> Manage Members
                </button>
                <button
                  onClick={() => { handleDelete(); setShowMenu(false); }}
                  className="dropdown-item-danger"
                  type="button"
                >
                  <Trash2 size={14} /> Delete Board
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Members Modal */}
      <BoardMembersModal board={board} isOpen={showMembers} onClose={() => setShowMembers(false)} />
    </header>
  );
}
