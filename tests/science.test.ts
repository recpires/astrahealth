/**
 * Guards against claiming scientific provenance that has not been confirmed.
 */
import { describe, expect, it } from "vitest";
import { NASA_RESOURCE, isResourceConfirmed } from "@/config/scientific-sources";
import { REFERENCE_CONFIG } from "@/config/reference-ranges";
import { PROCEDURES, PROCEDURE_DISCLAIMER } from "@/lib/response/procedures";
import { createInitialState, buildReportFromState } from "@/lib/mission/reducer";

describe("scientific provenance", () => {
  it("does not claim a NASA resource until the team confirms one", () => {
    if (NASA_RESOURCE.status === "pending-confirmation") {
      expect(isResourceConfirmed()).toBe(false);
      expect(NASA_RESOURCE.name).toBeNull();
      expect(NASA_RESOURCE.url).toBeNull();
      expect(NASA_RESOURCE.effectiveUse).toBeNull();
      expect(buildReportFromState(createInitialState()).scientificBasis.nasaResource).toMatch(/Pending team confirmation/);
    } else {
      // Once confirmed, every provenance field must be filled in.
      expect(isResourceConfirmed()).toBe(true);
    }
  });

  it("labels the reference ranges as provisional until confirmed", () => {
    if (REFERENCE_CONFIG.status === "PROVISIONAL") {
      expect(REFERENCE_CONFIG.provenance).toMatch(/Not clinically validated/);
    }
  });
});

describe("demonstration procedures", () => {
  it("are labelled as demonstration content", () => {
    expect(PROCEDURE_DISCLAIMER).toMatch(/NOT approved NASA flight procedures/);
  });

  it("never recommend medication, dosing or clinical interventions", () => {
    const text = PROCEDURES.flatMap((p) => [p.title, p.purpose, ...p.steps.map((s) => s.text)]).join(" ").toLowerCase();
    for (const word of ["mg", "dose", "medication", "medicine", "drug", "inject", "administer", "tablet", "pill", "oxygen mask", "defibrillat", "cpr"]) {
      expect(text).not.toMatch(new RegExp(`\\b${word}`));
    }
  });
});

describe("AI tools & usage disclosure", () => {
  it("is shown verbatim on the Science & limits page", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { ScienceView } = await import("@/components/science/ScienceView");
    render(ScienceView());
    const panel = screen.getByTestId("ai-disclosure");
    expect(panel).toHaveTextContent(
      "Team ANGARIS used AI-assisted tools, including Claude Code, Codex, and ChatGPT, as applicable, to support software development, code review, documentation, and presentation preparation.",
    );
    expect(panel).toHaveTextContent("is not a clinically validated medical device");
  });
});
