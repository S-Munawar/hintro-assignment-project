"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import { searchUsers, type UserSearchResult } from "@/lib/api";
import Modal from "@/components/Common/Modal";
import { Search, UserPlus, UserMinus, Shield, Pencil, Eye, Crown, Loader2 } from "lucide-react";
import type { BoardDetail, BoardMember, BoardRole } from "@/types";

const ROLE_ICONS: Record<BoardRole, typeof Shield> = {
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

const ROLE_LABELS: Record<BoardRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

interface BoardMembersModalProps {
  board: BoardDetail;
  isOpen: boolean;
  onClose: () => void;
}

export default function BoardMembersModal({ board, isOpen, onClose }: BoardMembersModalProps) {
  const { addMember, removeMember } = useBoardStore();
  const { addToast } = useToastStore();

  // ── Search state ────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<BoardRole>("editor");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await searchUsers(query.trim(), 10);
        // Filter out users who are already members or the owner
        const existingIds = new Set([
          board.owner_id,
          ...board.members.map((m) => m.user_id),
        ]);
        setResults(users.filter((u) => !existingIds.has(u.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, board.owner_id, board.members]);

  const handleAdd = useCallback(async (user: UserSearchResult) => {
    setAdding(user.id);
    try {
      await addMember(board.id, user.id, selectedRole);
      addToast(`${user.first_name} ${user.last_name} added as ${selectedRole}`, "success");
      // Remove from search results
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to add member", "error");
    } finally {
      setAdding(null);
    }
  }, [addMember, addToast, board.id, selectedRole]);

  const handleRemove = useCallback(async (member: BoardMember) => {
    if (!confirm(`Remove ${member.user.first_name} ${member.user.last_name} from this board?`)) return;
    setRemoving(member.user_id);
    try {
      await removeMember(board.id, member.user_id);
      addToast(`${member.user.first_name} ${member.user.last_name} removed`, "success");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to remove member", "error");
    } finally {
      setRemoving(null);
    }
  }, [removeMember, addToast, board.id]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Board Members" size="md">
      <div className="space-y-5">
        {/* ── Search + Role ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="input pl-9 w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Add as:</span>
            {(["editor", "viewer", "admin"] as BoardRole[]).map((role) => {
              const Icon = ROLE_ICONS[role];
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                    selectedRole === role
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <Icon size={12} />
                  {ROLE_LABELS[role]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search Results ────────────────────────────────────────── */}
        {query.trim().length >= 2 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {searching ? (
              <div className="flex items-center justify-center py-4 text-slate-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-sm">
                No users found
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {results.map((user) => (
                  <li key={user.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      disabled={adding === user.id}
                      onClick={() => handleAdd(user)}
                      className="ml-3 p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                    >
                      {adding === user.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <UserPlus size={16} />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Current Members ──────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Members ({board.members.length + 1})
          </h3>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {/* Owner (always first) */}
            <li className="flex items-center justify-between px-4 py-3 bg-slate-50/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                  {board.owner.first_name[0]}{board.owner.last_name?.[0] ?? ""}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {board.owner.first_name} {board.owner.last_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{board.owner.email}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                <Crown size={12} /> Owner
              </span>
            </li>

            {/* Members */}
            {board.members.map((member) => {
              const Icon = ROLE_ICONS[member.role];
              return (
                <li key={member.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                      {member.user.first_name[0]}{member.user.last_name?.[0] ?? ""}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {member.user.first_name} {member.user.last_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Icon size={12} /> {ROLE_LABELS[member.role]}
                    </span>
                    <button
                      type="button"
                      disabled={removing === member.user_id}
                      onClick={() => handleRemove(member)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {removing === member.user_id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <UserMinus size={14} />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}

            {board.members.length === 0 && (
              <li className="text-center py-4 text-slate-400 text-sm">
                No members yet. Search above to invite people.
              </li>
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
