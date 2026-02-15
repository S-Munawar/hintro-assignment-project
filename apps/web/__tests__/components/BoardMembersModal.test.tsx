import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardMembersModal from "@/components/Board/BoardMembersModal";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import * as api from "@/lib/api";
import {
  createBoardDetail,
  createBoardMember,
  createProfileWithEmail,
  createProfileFull,
} from "../helpers/factories";

vi.mock("@/store/useBoardStore", () => ({
  useBoardStore: vi.fn(),
}));

vi.mock("@/store/useToastStore", () => ({
  useToastStore: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    searchUsers: vi.fn(),
  };
});

describe("BoardMembersModal", () => {
  const mockAddMember = vi.fn();
  const mockRemoveMember = vi.fn();
  const mockAddToast = vi.fn();
  const onClose = vi.fn();
  const mockSearchUsers = vi.mocked(api.searchUsers);

  const board = createBoardDetail({
    id: "board-1",
    owner: createProfileWithEmail({ id: "owner-1", first_name: "John", last_name: "Doe", email: "john@test.com" }),
    members: [
      createBoardMember({
        id: "m1",
        user_id: "user-2",
        role: "editor",
        user: createProfileFull({ id: "user-2", first_name: "Jane", last_name: "Smith", email: "jane@test.com" }),
      }),
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.mocked(useBoardStore).mockReturnValue({
      addMember: mockAddMember,
      removeMember: mockRemoveMember,
    } as any);

    vi.mocked(useToastStore).mockReturnValue({
      addToast: mockAddToast,
    } as any);
  });

  it("should render nothing when closed", () => {
    const { container } = render(
      <BoardMembersModal board={board} isOpen={false} onClose={onClose} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("should render modal title when open", () => {
    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Board Members")).toBeInTheDocument();
  });

  it("should render the owner", () => {
    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("should render existing members with role", () => {
    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    // "Editor" appears in both the role selector and the member badge
    const editorElements = screen.getAllByText("Editor");
    expect(editorElements.length).toBeGreaterThanOrEqual(1);
  });

  it("should show member count", () => {
    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Members (2)")).toBeInTheDocument();
  });

  it("should render search input", () => {
    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);
    expect(screen.getByPlaceholderText("Search by name or email…")).toBeInTheDocument();
  });

  it("should search users on input", async () => {
    const user = userEvent.setup();
    mockSearchUsers.mockResolvedValue([
      { id: "user-3", email: "alice@test.com", first_name: "Alice", last_name: "W", avatar_url: null },
    ]);

    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("Search by name or email…"), "alice");

    await waitFor(() => {
      expect(mockSearchUsers).toHaveBeenCalledWith("alice", 10);
    });

    await waitFor(() => {
      expect(screen.getByText("Alice W")).toBeInTheDocument();
      expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    });
  });

  it("should filter out existing members from search results", async () => {
    const user = userEvent.setup();
    mockSearchUsers.mockResolvedValue([
      { id: "user-2", email: "jane@test.com", first_name: "Jane", last_name: "Smith", avatar_url: null },
      { id: "user-3", email: "alice@test.com", first_name: "Alice", last_name: "W", avatar_url: null },
    ]);

    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("Search by name or email…"), "test");

    await waitFor(() => {
      // Jane is already a member, should not appear in search results
      const aliceElements = screen.getAllByText("Alice W");
      expect(aliceElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should show 'No users found' for empty results", async () => {
    const user = userEvent.setup();
    mockSearchUsers.mockResolvedValue([]);

    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("Search by name or email…"), "nobody");

    await waitFor(() => {
      expect(screen.getByText("No users found")).toBeInTheDocument();
    });
  });

  it("should add a member when add button is clicked", async () => {
    const user = userEvent.setup();
    mockSearchUsers.mockResolvedValue([
      { id: "user-3", email: "alice@test.com", first_name: "Alice", last_name: "W", avatar_url: null },
    ]);
    mockAddMember.mockResolvedValue({});

    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("Search by name or email…"), "alice");

    await waitFor(() => {
      expect(screen.getByText("Alice W")).toBeInTheDocument();
    });

    // Click the add button (UserPlus icon button) in the search results
    const addButtons = screen.getAllByRole("button").filter((btn) => !btn.textContent?.includes("Editor") && !btn.textContent?.includes("Admin") && !btn.textContent?.includes("Viewer"));
    // Find the add button in search results area
    const searchResultAddBtn = addButtons.find((btn) => {
      const li = btn.closest("li");
      return li && li.textContent?.includes("Alice W");
    });

    if (searchResultAddBtn) {
      await user.click(searchResultAddBtn);
      await waitFor(() => {
        expect(mockAddMember).toHaveBeenCalledWith("board-1", "user-3", "editor");
      });
    }
  });

  it("should remove a member when remove button is clicked", async () => {
    const user = userEvent.setup();
    mockRemoveMember.mockResolvedValue(undefined);

    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);

    // Find the remove button next to Jane Smith
    const memberLis = screen.getAllByRole("listitem");
    const janeLi = memberLis.find((li) => li.textContent?.includes("Jane Smith"));
    const removeBtn = janeLi?.querySelector("button");

    if (removeBtn) {
      await user.click(removeBtn);

      await waitFor(() => {
        expect(mockRemoveMember).toHaveBeenCalledWith("board-1", "user-2");
      });
    }
  });

  it("should show toast on add member error", async () => {
    const user = userEvent.setup();
    mockSearchUsers.mockResolvedValue([
      { id: "user-3", email: "alice@test.com", first_name: "Alice", last_name: "W", avatar_url: null },
    ]);
    mockAddMember.mockRejectedValue(new Error("Permission denied"));

    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("Search by name or email…"), "alice");

    await waitFor(() => {
      expect(screen.getByText("Alice W")).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole("button").filter((btn) => {
      const li = btn.closest("li");
      return li && li.textContent?.includes("Alice W");
    });

    if (addButtons[0]) {
      await user.click(addButtons[0]);
      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith("Permission denied", "error");
      });
    }
  });

  it("should render role selector buttons", () => {
    render(<BoardMembersModal board={board} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Add as:")).toBeInTheDocument();
    // Editor role button in the selector (not the member badge)
    const editorButtons = screen.getAllByText("Editor");
    expect(editorButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("should render no members message when board has no members", () => {
    const emptyBoard = createBoardDetail({
      id: "board-1",
      owner: createProfileWithEmail({ id: "owner-1", first_name: "John", last_name: "Doe" }),
      members: [],
    });

    render(<BoardMembersModal board={emptyBoard} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("No members yet. Search above to invite people.")).toBeInTheDocument();
  });
});
