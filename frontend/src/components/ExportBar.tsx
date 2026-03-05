import { useState } from "react";

interface Props {
  sessionId: string;
  reporterCount: number;
}

export default function ExportBar({ sessionId, reporterCount }: Props) {
  const [copied, setCopied] = useState(false);

  async function downloadCsv() {
    const res = await fetch(`/api/export/${sessionId}/csv`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `honeyjar-${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyEmails() {
    const res = await fetch(`/api/export/${sessionId}/emails`);
    const data = await res.json();
    await navigator.clipboard.writeText(data.emails ?? data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-gray-500">
        {reporterCount} reporter{reporterCount !== 1 ? "s" : ""} found
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={downloadCsv}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={copyEmails}
          className="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
        >
          {copied ? "Copied!" : "Copy Emails"}
        </button>
      </div>
    </div>
  );
}
