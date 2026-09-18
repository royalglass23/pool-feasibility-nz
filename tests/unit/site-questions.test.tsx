import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
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
      screen.queryByRole("radio", { name: "Confirm route" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "I’m not sure" })).toBeChecked();
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
    await user.click(screen.getByRole("radio", { name: "Confirm route" }));
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string),
    ).toMatchObject({ routeResponse: "confirm", poolLayout });
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
      name: "Are there any visible conditions that could affect construction access or excavation?",
    });
    const nearby = screen.getByRole("group", {
      name: "Which existing features are close to the proposed pool area?",
    });
    await user.click(
      within(access).getByRole("checkbox", { name: "None of these" }),
    );
    await user.click(
      within(access).getByRole("checkbox", { name: "Gate or narrow passage" }),
    );
    within(access)
      .getByRole("checkbox", { name: "Apparently rocky ground" })
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
        name: "Are there any visible conditions that could affect construction access or excavation?",
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
