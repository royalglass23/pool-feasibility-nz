import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteQuestions } from "@/components/site-questions";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Site questions", () => {
  it("defaults to 300 mm, allows 200-600 mm, and warns below 300 mm", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (...args: [string, RequestInit?]) => {
      void args;
      return Response.json({
        assessmentSnapshot: "signed-clearance",
        answers: { version: 1 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SiteQuestions
        assessmentSnapshot="original-token"
        placementKey="pool-a"
        onSigned={vi.fn()}
      />,
    );

    const clearance = screen.getByRole("slider", {
      name: "Indicative excavation side clearance",
    });
    const siteQuestions = screen.getByRole("region", {
      name: "Pool builder site questions",
    });
    const excavationPlanning = screen.getByRole("region", {
      name: "Excavation planning",
    });
    expect(within(siteQuestions).getAllByRole("group")).toHaveLength(3);
    expect(within(siteQuestions).queryByRole("slider")).not.toBeInTheDocument();
    expect(within(excavationPlanning).getByRole("slider")).toBe(clearance);
    expect(clearance).toHaveValue("300");
    expect(screen.getByText("300 mm each side")).toBeVisible();
    expect(
      screen.queryByText(/below the provisional 300 mm starting point/i),
    ).not.toBeInTheDocument();

    fireEvent.change(clearance, { target: { value: "200" } });
    expect(clearance).toHaveValue("200");
    expect(
      screen.getByText(/below the provisional 300 mm starting point/i),
    ).toBeVisible();

    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[0]!,
    );
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[1]!,
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string),
    ).toMatchObject({ sideClearanceMillimetres: 200 });
  });

  it("shows uncertainty without a confirm action when mapped route evidence is insufficient", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (...args: [string, RequestInit?]) => {
      void args;
      return Response.json({
        assessmentSnapshot: "signed-uncertain",
        answers: { version: 1 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SiteQuestions
        assessmentSnapshot="original-token"
        placementKey="pool-a"
        routeSuggestion={{
          confidence: "uncertain",
          geometry: null,
          reason: "terrain_unavailable_or_steep",
        }}
        onSigned={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("radio", { name: "Use proposed route" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Access route not confirmed" }),
    ).toBeChecked();
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[0]!,
    );
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[1]!,
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
  it("requires a response to a visible route suggestion and submits confirmation with the pool layout", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return Response.json({
        assessmentSnapshot: "signed-route",
        answers: { version: 1 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const poolLayout = {
      position: [174.76015, -36.8499] as [number, number],
      lengthMetres: 4,
      widthMetres: 2.4,
      rotationDegrees: 0,
    };
    render(
      <SiteQuestions
        assessmentSnapshot="original-token"
        placementKey="pool-a"
        poolLayout={poolLayout}
        routeSuggestion={{
          confidence: "credible",
          reason: "direct_clear_corridor",
          geometry: {
            type: "LineString",
            coordinates: [[174.76015, -36.85], poolLayout.position],
          },
        }}
        onSigned={vi.fn()}
      />,
    );
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[0]!,
    );
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[1]!,
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Use proposed route" }));
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string),
    ).toMatchObject({ routeResponse: "confirm", poolLayout });
  });
  it("adds no more than two turning points and sends adjusted provenance", async () => {
    const user = userEvent.setup();
    const onRouteEdit = vi.fn();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return Response.json({
        assessmentSnapshot: "signed-adjustment",
        answers: { version: 1 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const suggestion = {
      confidence: "credible" as const,
      reason: "direct_clear_corridor" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [174.76, -36.85],
          [174.7601, -36.8499],
        ] as [number, number][],
      },
    };
    const poolLayout = {
      position: [174.7601, -36.8499] as [number, number],
      lengthMetres: 4,
      widthMetres: 2.4,
      rotationDegrees: 0,
    };
    const view = render(
      <SiteQuestions
        assessmentSnapshot="token"
        placementKey="pool-a"
        routeSuggestion={suggestion}
        poolLayout={poolLayout}
        onRouteEdit={onRouteEdit}
        onSigned={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Add route turning point" }),
    );
    const first = onRouteEdit.mock.lastCall![0];
    expect(first.coordinates).toHaveLength(3);
    view.rerender(
      <SiteQuestions
        assessmentSnapshot="token"
        placementKey="pool-a"
        routeSuggestion={suggestion}
        poolLayout={poolLayout}
        adjustedRoute={first}
        onRouteEdit={onRouteEdit}
        onSigned={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Add route turning point" }),
    );
    const second = onRouteEdit.mock.lastCall![0];
    expect(second.coordinates).toHaveLength(4);
    view.rerender(
      <SiteQuestions
        assessmentSnapshot="token"
        placementKey="pool-a"
        routeSuggestion={suggestion}
        poolLayout={poolLayout}
        adjustedRoute={second}
        onRouteEdit={onRouteEdit}
        onSigned={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Add route turning point" }),
    ).toBeDisabled();
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[0]!,
    );
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[1]!,
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string),
    ).toMatchObject({
      routeResponse: "adjust",
      adjustedRoute: second,
    });
  });
  it("shows both fixed questions, supports multiple selections and exclusive answers by keyboard", async () => {
    const user = userEvent.setup();
    const onSigned = vi.fn();
    const fetchMock = vi.fn(async (...args: [string, RequestInit?]) => {
      void args;
      return Response.json({
        assessmentSnapshot: "signed-site-token",
        answers: { version: 1 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SiteQuestions
        assessmentSnapshot="original-token"
        placementKey="pool-a"
        onSigned={onSigned}
      />,
    );

    const access = screen.getByRole("group", {
      name: "Which visible site conditions could affect plant access or excavation?",
    });
    const nearby = screen.getByRole("group", {
      name: "Which existing features are close to the proposed pool area?",
    });
    await user.click(
      within(access).getByRole("checkbox", { name: "None of these" }),
    );
    await user.click(
      within(access).getByRole("checkbox", {
        name: "Restricted gate or narrow access",
      }),
    );
    within(access)
      .getByRole("checkbox", { name: "Rocky ground evident" })
      .focus();
    await user.keyboard(" ");
    expect(
      within(access).getByRole("checkbox", { name: "None of these" }),
    ).not.toBeChecked();
    await user.click(within(nearby).getByRole("checkbox", { name: "Fences" }));
    await user.click(
      within(nearby).getByRole("checkbox", { name: "I’m not sure" }),
    );
    expect(
      within(nearby).getByRole("checkbox", { name: "Fences" }),
    ).not.toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );

    await waitFor(() =>
      expect(onSigned).toHaveBeenCalledWith(
        expect.objectContaining({ snapshot: "signed-site-token" }),
      ),
    );
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string),
    ).toMatchObject({
      assessmentSnapshot: "original-token",
      accessConditions: ["gate_or_narrow_passage", "rocky_ground"],
      nearbyFeatures: ["not_sure"],
    });
  });

  it("requires both answers, focuses the first incomplete question and preserves choices after a request failure", async () => {
    const user = userEvent.setup();
    const onSigned = vi.fn();
    const fetchMock = vi.fn(async () =>
      Response.json({ error: { code: "TEMPORARY" } }, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SiteQuestions
        assessmentSnapshot="original-token"
        placementKey="pool-a"
        onSigned={onSigned}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    expect(
      screen.getByRole("group", {
        name: "Which visible site conditions could affect plant access or excavation?",
      }),
    ).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[0]!,
    );
    await user.click(
      screen.getAllByRole("checkbox", { name: "None of these" })[1]!,
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "couldn’t save your Site answers",
    );
    expect(
      screen.getAllByRole("checkbox", { name: "None of these" })[0],
    ).toBeChecked();
    expect(onSigned).not.toHaveBeenCalledWith(
      expect.objectContaining({ snapshot: expect.any(String) }),
    );
  });

  it.each(["snapshot", "pool position"] as const)(
    "ignores a completed signing request after the %s changes",
    async (changed) => {
      const user = userEvent.setup();
      let resolveRequest!: (value: Response) => void;
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              resolveRequest = resolve;
            }),
        ),
      );
      const onSigned = vi.fn();
      const view = render(
        <SiteQuestions
          assessmentSnapshot="old-token"
          placementKey="pool-a"
          onSigned={onSigned}
        />,
      );
      await user.click(
        screen.getAllByRole("checkbox", { name: "None of these" })[0]!,
      );
      await user.click(
        screen.getAllByRole("checkbox", { name: "None of these" })[1]!,
      );
      await user.click(
        screen.getByRole("button", { name: "Continue to your details" }),
      );
      view.rerender(
        <SiteQuestions
          key={changed}
          assessmentSnapshot={
            changed === "snapshot" ? "new-token" : "old-token"
          }
          placementKey={changed === "pool position" ? "pool-b" : "pool-a"}
          onSigned={onSigned}
        />,
      );
      await act(async () =>
        resolveRequest(
          Response.json({
            assessmentSnapshot: "signed-old-token",
            answers: { version: 1 },
          }),
        ),
      );
      expect(onSigned).not.toHaveBeenCalledWith(
        expect.objectContaining({ snapshot: "signed-old-token" }),
      );
    },
  );
});
