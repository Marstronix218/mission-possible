import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const mode = vi.hoisted(() => ({ isMockMode: false }));
vi.mock("@/lib/data-mode", () => mode);
vi.mock("@/components/designer/designer-page", () => ({
  default: function SoloDesigner() { return null; },
}));
vi.mock("@/components/designer/mission-briefing", () => ({
  default: function SoloBriefing() { return null; },
}));
vi.mock("@/components/results/MissionExperience", () => ({
  default: function SharedMissionExperience() { return null; },
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
import Page from "@/app/(game)/mission/[slug]/design/page";
import BriefPage from "@/app/(game)/mission/[slug]/brief/page";
import UpstreamBrief from "./mission-briefing";
import UpstreamDesign from "./designer-page";
import MissionExperience from "@/components/results/MissionExperience";

const params = () => Promise.resolve({ slug: "los-angeles" });

describe("designer route integration", () => {
  beforeEach(() => { mode.isMockMode = false; });

  it("uses the story-driven designer for live solo players", async () => {
    const page = await Page({ params: params(), searchParams: Promise.resolve({}) });
    expect(page.type).toBe("main");
    expect((page.props.children as ReactElement).type).toBe(UpstreamDesign);
  });

  it("retains classroom and attempt context in the live classroom designer", async () => {
    const page = await Page({
      params: params(),
      searchParams: Promise.resolve({ classroom: "class-123", attempt: "prior-attempt" }),
    });
    expect(page.type).toBe(MissionExperience);
    expect(page.props).toMatchObject({
      stage: "design", classroomId: "class-123", attemptId: "prior-attempt",
    });
  });

  it("uses the story-driven designer for mock solo players too", async () => {
    mode.isMockMode = true;
    const page = await Page({ params: params(), searchParams: Promise.resolve({}) });
    expect(page.type).toBe("main");
    expect((page.props.children as ReactElement).type).toBe(UpstreamDesign);
  });

  it("keeps the shared classroom designer in mock mode", async () => {
    mode.isMockMode = true;
    const page = await Page({ params: params(), searchParams: Promise.resolve({ classroom: "class-123" }) });
    expect(page.type).toBe(MissionExperience);
    expect(page.props).toMatchObject({ stage: "design", classroomId: "class-123" });
  });

  it("uses the story-driven briefing for live solo players", async () => {
    const page = await BriefPage({ params: params(), searchParams: Promise.resolve({}) });
    expect(page.type).toBe("main");
    expect((page.props.children as ReactElement).type).toBe(UpstreamBrief);
  });

  it("retains classroom and attempt context in the live classroom briefing", async () => {
    const page = await BriefPage({
      params: params(),
      searchParams: Promise.resolve({ classroom: "class-123", attempt: "prior-attempt" }),
    });
    expect(page.type).toBe(MissionExperience);
    expect(page.props).toMatchObject({
      stage: "brief", classroomId: "class-123", attemptId: "prior-attempt",
    });
  });

  it("uses the story-driven briefing for mock solo players too", async () => {
    mode.isMockMode = true;
    const page = await BriefPage({ params: params(), searchParams: Promise.resolve({}) });
    expect(page.type).toBe("main");
    expect((page.props.children as ReactElement).type).toBe(UpstreamBrief);
  });

  it("keeps the shared classroom briefing in mock mode", async () => {
    mode.isMockMode = true;
    const page = await BriefPage({ params: params(), searchParams: Promise.resolve({ classroom: "class-123" }) });
    expect(page.type).toBe(MissionExperience);
    expect(page.props).toMatchObject({ stage: "brief", classroomId: "class-123" });
  });

  it("rejects unknown missions before rendering a designer", async () => {
    await expect(Page({
      params: Promise.resolve({ slug: "unknown-city" }), searchParams: Promise.resolve({}),
    })).rejects.toThrow("NOT_FOUND");
  });
});
