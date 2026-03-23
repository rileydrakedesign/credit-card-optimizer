"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { NormalizedTransaction } from "@/lib/types";

interface Props {
  hasData: boolean;
  onTransactionsLoaded: (txns: NormalizedTransaction[]) => void;
  onLoadSample: () => void;
  onReset?: () => void;
}

type Status = "idle" | "linking" | "loading" | "success" | "error";

export default function PlaidLinkSection({
  hasData,
  onTransactionsLoaded,
  onLoadSample,
  onReset,
}: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [linkedInstitution, setLinkedInstitution] = useState<string | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchToken() {
      try {
        const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
        const data = await res.json();
        if (!cancelled) {
          if (data.error) {
            setError(data.error);
            setStatus("error");
          } else {
            setLinkToken(data.link_token);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Failed to initialize bank connection.");
          setStatus("error");
        }
      }
    }
    fetchToken();
    return () => { cancelled = true; };
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string; institution_id?: string } | null }) => {
      const institutionName = metadata.institution?.name || "Bank";
      setLinkedInstitution(institutionName);
      setStatus("linking");
      setError(null);

      try {
        const exchangeRes = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const exchangeData = await exchangeRes.json();
        if (exchangeData.error) throw new Error(exchangeData.error);

        setStatus("loading");
        await new Promise(r => setTimeout(r, 3000));

        const txnRes = await fetch("/api/plaid/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ institution_name: institutionName }),
        });
        const txnData = await txnRes.json();
        if (txnData.error) throw new Error(txnData.error);

        setTransactionCount(txnData.transactions.length);
        setStatus("success");
        onTransactionsLoaded(txnData.transactions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transactions.");
        setStatus("error");
      }
    },
    [onTransactionsLoaded]
  );

  const onExit = useCallback(
    (err: { error_message?: string } | null) => {
      if (err) {
        setError(err.error_message || "Connection was interrupted.");
        setStatus("error");
      }
    },
    []
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  });

  const handleRetry = useCallback(async () => {
    setError(null);
    setStatus("idle");
    setLinkToken(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setStatus("error");
      } else {
        setLinkToken(data.link_token);
      }
    } catch {
      setError("Failed to initialize bank connection.");
      setStatus("error");
    }
  }, []);

  // Compact top bar when data is loaded
  if (hasData) {
    return (
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-[var(--muted)]">
            {linkedInstitution ? `Connected to ${linkedInstitution}` : "Sample data loaded"}
            {transactionCount > 0 && ` \u2014 ${transactionCount} transactions`}
          </span>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="text-sm text-[var(--muted)] hover:text-white transition-colors"
          >
            Start over
          </button>
        )}
      </div>
    );
  }

  // Full-screen onboarding
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Find your <span className="text-emerald-400">best card</span>
        </h1>
        <p className="text-lg text-[var(--muted)] mb-12">
          Connect your bank to see which credit card earns the most on your actual spending.
        </p>

        {/* Error state */}
        {status === "error" && (
          <div className="mb-8 rounded-xl p-6 bg-red-950/50 border border-red-800">
            <p className="text-red-400 font-medium mb-3">{error}</p>
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Linking / Loading state */}
        {(status === "linking" || status === "loading") && (
          <div className="mb-8 rounded-xl p-12 bg-[var(--surface)] border border-[var(--border)]">
            <div className="inline-block w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg font-medium mb-1">
              {status === "linking"
                ? `Connecting to ${linkedInstitution}...`
                : "Pulling your transactions..."}
            </p>
            <p className="text-sm text-[var(--muted)]">This takes a few seconds</p>
          </div>
        )}

        {/* Success state */}
        {status === "success" && (
          <div className="mb-8 rounded-xl p-6 bg-emerald-950/50 border border-emerald-800">
            <p className="text-emerald-400 font-medium">
              Connected to {linkedInstitution} — {transactionCount} transactions loaded
            </p>
          </div>
        )}

        {/* Idle state */}
        {status === "idle" && (
          <>
            <button
              onClick={() => open()}
              disabled={!ready}
              className="w-full py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-4"
            >
              {ready ? "Connect your bank" : "Initializing..."}
            </button>

            <button
              onClick={onLoadSample}
              className="text-sm text-[var(--muted)] hover:text-white transition-colors"
            >
              or try with sample data
            </button>
          </>
        )}
      </div>
    </div>
  );
}
