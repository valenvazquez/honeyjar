import { useState } from "react";
import type { OutletType, Geography, ClarifyingData } from "../types";

const OUTLET_OPTIONS: { value: OutletType; label: string }[] = [
  { value: "national_business_tech", label: "National Business/Tech" },
  { value: "trade_specialist", label: "Trade/Specialist" },
  { value: "regional", label: "Regional" },
  { value: "newsletters", label: "Newsletters" },
  { value: "podcasts", label: "Podcasts" },
];

const GEO_OPTIONS: { value: Geography; label: string }[] = [
  { value: "us_only", label: "US Only" },
  { value: "us_eu_uk", label: "US + EU/UK" },
  { value: "global", label: "Global" },
];

interface Props {
  data: ClarifyingData;
  onSubmit: (payload: string) => void;
  disabled?: boolean;
}

export default function ClarifyingPrompts({ data, onSubmit, disabled }: Props) {
  const [outlets, setOutlets] = useState<OutletType[]>(data.suggestedOutletTypes ?? []);
  const [geos, setGeos] = useState<Geography[]>(data.suggestedGeography ?? []);
  const [prioritize, setPrioritize] = useState("");
  const [competitors, setCompetitors] = useState("");

  function toggleOutlet(v: OutletType) {
    setOutlets((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  function toggleGeo(v: Geography) {
    setGeos((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  function handleSubmit() {
    const payload = {
      outletTypes: outlets,
      geography: geos,
      prioritizedPubs: prioritize.trim() || undefined,
      competitorContext: competitors.trim() || undefined,
    };
    onSubmit(JSON.stringify(payload));
  }

  return (
    <div className="space-y-4">
      {data.followUpQuestion && (
        <p className="text-sm text-gray-700">{data.followUpQuestion}</p>
      )}

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Outlet Types
        </p>
        <div className="flex flex-wrap gap-2">
          {OUTLET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => toggleOutlet(opt.value)}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                outlets.includes(opt.value)
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Geography
        </p>
        <div className="flex flex-wrap gap-2">
          {GEO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => toggleGeo(opt.value)}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                geos.includes(opt.value)
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Publications to prioritize
          </label>
          <input
            type="text"
            value={prioritize}
            onChange={(e) => setPrioritize(e.target.value)}
            disabled={disabled}
            placeholder="e.g. TechCrunch, WSJ"
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Competitors / related announcements
          </label>
          <input
            type="text"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            disabled={disabled}
            placeholder="e.g. Acme Inc Series B"
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || (outlets.length === 0 && geos.length === 0)}
        className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Find Reporters
      </button>
    </div>
  );
}
