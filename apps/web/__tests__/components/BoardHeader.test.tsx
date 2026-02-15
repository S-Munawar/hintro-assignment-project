import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardHeader from "@/components/Board/BoardHeader";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import { createBoardDetail, createListWithTasks, createTask, createBoardMember } from "../helpers/factories";

const mockPush = vi.fn();

vi.mock("next/navigation", async () => {
  return {
    useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/board/board-1",
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock("@/store/useBoardStore", () => ({
  useBoardStore: vi.fn(),
}));

vi.mock("@/store/useToastStore", () => ({
  useToastStore: vi.fn(),
}));

describe("BoardHeader", () => {
  const mockUpdateBoard = vi.fn();
  const mockDeleteBoard = vi.fn();
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBoardStore).mockReturnValue({
      updateBoard: mockUpdateBoard,
      deleteBoard: mockDeleteBoard,
    } as any);
    vi.mocked(useToastStore).mockReturnValue({ addToast: mockAddToast } as any);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  const defaultBoard = createBoardDetail({
    name: "My Board",
    color: "#6366f1",
    lists: [
      createListWithTasks({
        tasks: [createTask({ id: "t1" }), createTask({ id: "t2" })],
      }),
    ],
    members: [createBoardMember()],
  });

  it("should render board name", () => {
    render(<BoardHeader board={defaultBoard} />);
    expect(screen.getByText("My Board")).toBeInTheDocument();
  });

  it("should render back link to dashboard", () => {
    render(<BoardHeader board={defaultBoard} />);
    const backLink = screen.getByRole("link", { name: "" });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("should render board stats", () => {
    render(<BoardHeader board={defaultBoard} />);
    // Lists count
    expect(screen.getByText("1")).toBeInTheDocument();
    // Tasks and members badges share the same count — use getAllByText
    const twoBadges = screen.getAllByText("2");
    expect(twoBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("should show menu when menu button is clicked", async () => {
    render(<BoardHeader board={defaultBoard} />);
    // Target the MoreHorizontal (⋯) menu button — it's the last generic button
    const menuBtn = screen.getAllByRole("button").find((b) => !b.getAttribute("title") && !b.textContent?.trim());
    await userEvent.click(menuBtn!);

    expect(screen.getByText("Rename Board")).toBeInTheDocument();
    expect(screen.getByText("Delete Board")).toBeInTheDocument();
  });

  it("should allow inline rename on click", async () => {
    render(<BoardHeader board={defaultBoard} />);
    await userEvent.click(screen.getByText("My Board"));

    expect(screen.getByDisplayValue("My Board")).toBeInTheDocument();
  });

  it("should call updateBoard on rename", async () => {
    mockUpdateBoard.mockResolvedValue({});
    render(<BoardHeader board={defaultBoard} />);

    await userEvent.click(screen.getByText("My Board"));
    const input = screen.getByDisplayValue("My Board");
    await userEvent.clear(input);
    await userEvent.type(input, "Updated Name");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockUpdateBoard).toHaveBeenCalledWith(defaultBoard.id, { name: "Updated Name" });
    });
  });

  it("should show success toast on rename", async () => {
    mockUpdateBoard.mockResolvedValue({});
    render(<BoardHeader board={defaultBoard} />);

    await userEvent.click(screen.getByText("My Board"));
    const input = screen.getByDisplayValue("My Board");
    await userEvent.clear(input);
    await userEvent.type(input, "New");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("Board renamed", "success");
    });
  });

  it("should revert and not call updateBoard if name unchanged", async () => {
    render(<BoardHeader board={defaultBoard} />);
    await userEvent.click(screen.getByText("My Board"));
    const input = screen.getByDisplayValue("My Board");
    fireEvent.blur(input);

    expect(mockUpdateBoard).not.toHaveBeenCalled();
  });

  it("should call deleteBoard when Delete Board is clicked", async () => {
    mockDeleteBoard.mockResolvedValue({});
    render(<BoardHeader board={defaultBoard} />);

    // Open menu
    const menuBtn = screen.getAllByRole("button").find((b) => !b.getAttribute("title") && !b.textContent?.trim());
    await userEvent.click(menuBtn!);
    await userEvent.click(screen.getByText("Delete Board"));

    await waitFor(() => {
      expect(mockDeleteBoard).toHaveBeenCalledWith(defaultBoard.id);
    });
  });

  it("should navigate to / after deletion", async () => {
    mockDeleteBoard.mockResolvedValue({});
    render(<BoardHeader board={defaultBoard} />);

    const menuBtn = screen.getAllByRole("button").find((b) => !b.getAttribute("title") && !b.textContent?.trim());
    await userEvent.click(menuBtn!);
    await userEvent.click(screen.getByText("Delete Board"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("should show error toast on rename failure", async () => {
    mockUpdateBoard.mockRejectedValue(new Error("fail"));
    render(<BoardHeader board={defaultBoard} />);

    await userEvent.click(screen.getByText("My Board"));
    const input = screen.getByDisplayValue("My Board");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("Failed to rename board", "error");
    });
  });

  it("should show error toast on delete failure", async () => {
    mockDeleteBoard.mockRejectedValue(new Error("fail"));
    render(<BoardHeader board={defaultBoard} />);

    const menuBtn = screen.getAllByRole("button").find((b) => !b.getAttribute("title") && !b.textContent?.trim());
    await userEvent.click(menuBtn!);
    await userEvent.click(screen.getByText("Delete Board"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("Failed to delete board", "error");
    });
  });

  it("should cancel rename on Escape", async () => {
    render(<BoardHeader board={defaultBoard} />);
    await userEvent.click(screen.getByText("My Board"));
    const input = screen.getByDisplayValue("My Board");
    await userEvent.clear(input);
    await userEvent.type(input, "Changed");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByText("My Board")).toBeInTheDocument();
  });
});
