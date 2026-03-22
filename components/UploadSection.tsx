"use client";

import { useState, useCallback, useRef } from "react";
import { NormalizedTransaction, ColumnMapping, ParsedCSV } from "@/lib/types";
import { parseCSVText, autoDetectColumns, isValidMapping } from "@/lib/csv/parser";
import { normalizeTransactions } from "@/lib/csv/normalizer";

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  onFilesProcessed: (txns: NormalizedTransaction[]) => void;
  onLoadSample: () => void;
  onReset?: () => void;
}

export default function UploadSection({ isOpen, onToggle, onFilesProcessed, onLoadSample, onReset }: Props) {
  const [parsedFiles, setParsedFiles] = useState<ParsedCSV[]>([]);
  const [mappings, setMappings] = useState<Record<string, Partial<ColumnMapping>>>({});
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    const newParsed: ParsedCSV[] = [];
    const newMappings: Record<string, Partial<ColumnMapping>> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith(".csv")) continue;
      const text = await file.text();
      const parsed = parseCSVText(text, file.name);
      newParsed.push(parsed);
      newMappings[file.name] = autoDetectColumns(parsed.headers);
    }

    if (newParsed.length > 0) {
      setParsedFiles(newParsed);
      setMappings(newMappings);
      setStep("map");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleSubmit = useCallback(() => {
    const allTxns: NormalizedTransaction[] = [];
    for (const parsed of parsedFiles) {
      const mapping = mappings[parsed.fileName];
      if (!isValidMapping(mapping)) continue;
      const txns = normalizeTransactions(parsed, mapping);
      allTxns.push(...txns);
    }
    if (allTxns.length > 0) {
      onFilesProcessed(allTxns);
      setStep("upload");
      setParsedFiles([]);
      setMappings({});
    }
  }, [parsedFiles, mappings, onFilesProcessed]);

  const updateMapping = (fileName: string, field: keyof ColumnMapping, value: string) => {
    setMappings(prev => ({
      ...prev,
      [fileName]: { ...prev[fileName], [field]: value },
    }));
  };

  const allValid = parsedFiles.every(p => isValidMapping(mappings[p.fileName]));

  return (
    <section className="mb-8">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-lg font-semibold mb-4 hover:text-blue-600 transition-colors"
      >
        <span className={`transform transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
        Upload Transactions
        {onReset && (
          <span
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            className="ml-4 text-sm text-red-500 hover:text-red-700 font-normal"
          >
            Reset
          </span>
        )}
      </button>

      {isOpen && (
        <div className="space-y-4">
          {step === "upload" && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                }`}
              >
                <p className="text-lg font-medium mb-2">Drop CSV files here or click to browse</p>
                <p className="text-sm text-gray-500">Supports multiple files</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </div>

              <div className="text-center">
                <span className="text-gray-400 text-sm">or</span>
              </div>

              <button
                onClick={onLoadSample}
                className="w-full py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Load Sample CSV Data
              </button>
            </>
          )}

          {step === "map" && (
            <div className="space-y-6">
              {parsedFiles.map(parsed => (
                <div key={parsed.fileName} className="border rounded-lg p-4 dark:border-gray-700">
                  <h3 className="font-semibold mb-3">{parsed.fileName} ({parsed.rows.length} rows)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MappingSelect
                      label="Date Column"
                      value={mappings[parsed.fileName]?.date || ""}
                      options={parsed.headers}
                      onChange={(v) => updateMapping(parsed.fileName, "date", v)}
                    />
                    <MappingSelect
                      label="Description Column"
                      value={mappings[parsed.fileName]?.description || ""}
                      options={parsed.headers}
                      onChange={(v) => updateMapping(parsed.fileName, "description", v)}
                    />
                    <MappingSelect
                      label="Amount Column"
                      value={mappings[parsed.fileName]?.amount || ""}
                      options={["", ...parsed.headers]}
                      onChange={(v) => updateMapping(parsed.fileName, "amount", v)}
                    />
                    <MappingSelect
                      label="Debit Column"
                      value={mappings[parsed.fileName]?.debit || ""}
                      options={["", ...parsed.headers]}
                      onChange={(v) => updateMapping(parsed.fileName, "debit", v)}
                    />
                    <MappingSelect
                      label="Credit Column"
                      value={mappings[parsed.fileName]?.credit || ""}
                      options={["", ...parsed.headers]}
                      onChange={(v) => updateMapping(parsed.fileName, "credit", v)}
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("upload"); setParsedFiles([]); setMappings({}); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!allValid}
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analyze Transactions
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MappingSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
      >
        <option value="">-- Select --</option>
        {options.filter(o => o).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}
