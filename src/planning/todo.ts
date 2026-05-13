export type PlanStatus = "pending" | "in_progress" | "completed";

export type PlanItem = {
  content: string;
  status: PlanStatus;
  activeForm: string;
};

export type PlanningState = {
  items: PlanItem[];
  roundsSinceUpdate: number;
  updateCount: number;
};

type RawPlanItem = {
  content?: unknown;
  status?: unknown;
  activeForm?: unknown;
};

const statusMarkers: Record<PlanStatus, string> = {
  pending: "[ ]",
  in_progress: "[>]",
  completed: "[x]",
};

function normalizeStatus(status: unknown): PlanStatus {
  if (status === undefined) {
    return "pending";
  }

  if (status === "pending" || status === "in_progress" || status === "completed") {
    return status;
  }

  throw new Error(`Invalid todo status: ${String(status)}`);
}

function normalizePlanItem(item: RawPlanItem): PlanItem {
  if (typeof item.content !== "string" || item.content.trim() === "") {
    throw new Error("Todo item content must be a non-empty string");
  }

  return {
    content: item.content.trim(),
    status: normalizeStatus(item.status),
    activeForm: typeof item.activeForm === "string" ? item.activeForm.trim() : "",
  };
}

export class TodoManager {
  #items: PlanItem[] = [];
  #roundsSinceUpdate = 0;
  #updateCount = 0;

  get roundsSinceUpdate(): number {
    return this.#roundsSinceUpdate;
  }

  get updateCount(): number {
    return this.#updateCount;
  }

  get hasItems(): boolean {
    return this.#items.length > 0;
  }

  snapshot(): PlanningState {
    return {
      items: this.#items.map((item) => ({ ...item })),
      roundsSinceUpdate: this.#roundsSinceUpdate,
      updateCount: this.#updateCount,
    };
  }

  markRoundWithoutUpdate(): void {
    this.#roundsSinceUpdate += 1;
  }

  update(items: RawPlanItem[]): string {
    const nextItems = items.map(normalizePlanItem);
    const inProgressCount = nextItems.filter(
      (item) => item.status === "in_progress",
    ).length;

    if (inProgressCount > 1) {
      throw new Error("Only one todo item can be in_progress");
    }

    this.#items = nextItems;
    this.#roundsSinceUpdate = 0;
    this.#updateCount += 1;

    return this.render();
  }

  render(): string {
    if (this.#items.length === 0) {
      return "(no todo items)";
    }

    return this.#items
      .map((item) => `${statusMarkers[item.status]} ${item.content}`)
      .join("\n");
  }

  renderPanel(): string {
    const activeItem = this.#items.find((item) => item.status === "in_progress");
    const plan = this.render();

    if (!activeItem) {
      return plan;
    }

    const activeText = activeItem.activeForm || activeItem.content;

    return `Current: ${activeText}\n${plan}`;
  }
}
