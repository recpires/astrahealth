/**
 * Science & Limits page: provenance, evidence library and OSDR import.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ScienceView } from "@/components/science/ScienceView";
import { OsdrDatasetPanel } from "@/components/science/OsdrDatasetPanel";

const fixture = readFileSync(join(__dirname, "..", "fixtures", "osdr-multiplex-sample.csv"), "utf8");

function csvFile(text: string, name: string): File {
  const f = new File([text], name, { type: "text/csv" });
  // jsdom's File lacks text() in some versions.
  if (!("text" in f) || typeof f.text !== "function") Object.defineProperty(f, "text", { value: async () => text });
  return f;
}

describe("Science & Limits", () => {
  it("distinguishes simulated data, real scientific data and demonstration rules", () => {
    render(<ScienceView />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Science & Limits");
    const legend = screen.getByTestId("provenance-legend");
    for (const label of ["Simulated data", "Real scientific data & evidence", "Demonstration rules"]) {
      expect(within(legend).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByTestId("provenance-table")).toHaveTextContent("OSD-575");
  });

  it("lists the NASA HRP evidence with title, source, link and limitations, filterable by topic", async () => {
    render(<ScienceView />);
    const cv = screen.getByTestId("evidence-hrp-cardiovascular-2022");
    expect(cv).toHaveTextContent("Risk of Cardiovascular Adaptations");
    expect(cv).toHaveTextContent("NASA Human Research Program");
    expect(cv).toHaveTextContent("Limitations");
    expect(within(cv).getByRole("link", { name: /Evidence report \(PDF, HRR\)/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/humanresearchroadmap\.nasa\.gov\/evidence\/reports\//),
    );
    await userEvent.click(screen.getByRole("button", { name: "Hypoxia" }));
    expect(screen.queryByTestId("evidence-hrp-cardiovascular-2022")).not.toBeInTheDocument();
    expect(screen.getByTestId("evidence-hrp-dcs-hypoxia-2023")).toBeInTheDocument();
  });

  it("identifies the OSDR source and shows summary statistics only", () => {
    render(<OsdrDatasetPanel />);
    const src = screen.getByTestId("osdr-source");
    expect(within(src).getByRole("link", { name: /OSD-575/ })).toHaveAttribute("href", "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575");
    expect(src).toHaveTextContent("NASA Open Science Data Repository (OSDR)");
    expect(screen.getByTestId("osdr-summary")).toHaveTextContent("4 crew members");
    expect(screen.getByTestId("osdr-table")).not.toHaveTextContent(/C00\d/);
  });

  it("requires an accession and rejects unsupported files on import", async () => {
    render(<OsdrDatasetPanel />);
    const input = screen.getByTestId("osdr-file-input");
    fireEvent.change(input, { target: { files: [csvFile(fixture, "sample.csv")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/accession/);
    await userEvent.type(screen.getByLabelText("Accession"), "OSD-575");
    fireEvent.change(input, { target: { files: [csvFile("a,b\n1,2", "bad.csv")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Unsupported file/);
  });

  it("imports a valid OSDR file into the page only, labelled with its declared source", async () => {
    render(<OsdrDatasetPanel />);
    await userEvent.type(screen.getByLabelText("Accession"), "osd-575");
    fireEvent.change(screen.getByTestId("osdr-file-input"), { target: { files: [csvFile(fixture, "my-osdr.csv")] } });
    await waitFor(() => expect(screen.getByTestId("osdr-imported")).toBeInTheDocument());
    const box = screen.getByTestId("osdr-imported");
    expect(box).toHaveTextContent("Imported in this browser — not saved");
    expect(box).toHaveTextContent("OSD-575");
    expect(box).toHaveTextContent("my-osdr.csv");
    expect(box).toHaveTextContent("2 crew members");
  });
});
