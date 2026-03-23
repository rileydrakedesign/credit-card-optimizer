"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { NormalizedTransaction } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  onTransactionsLoaded: (txns: NormalizedTransaction[]) => void;
  onLoadSample: () => void;
  onReset?: () => void;
}

type Status = "idle" | "linking" | "loading" | "success" | "error";

export default function PlaidLinkSection({
  isOpen,
  onToggle,
  onTransactionsLoaded,
  onLoadSample,
  onReset,
}: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [linkedInstitution, setLinkedInstitution] = useState<string | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);

  // Fetch link token on mount
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
        // Exchange public token for access token
        const exchangeRes = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const exchangeData = await exchangeRes.json();
        if (exchangeData.error) throw new Error(exchangeData.error);

        // Wait for Plaid to prepare transaction data — transactionsSync
        // isn't immediately available after item creation (documented behavior).
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

  return (
    <section className="mb-8">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-lg font-semibold mb-4 hover:text-blue-600 transition-colors"
      >
        <span className={`transform transition-transform ${isOpen ? "rotate-90" : ""}`}>
          ▶
        </span>
        Connect Bank Account
        {onReset && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="ml-4 text-sm text-red-500 hover:text-red-700 font-normal"
          >
            Reset
          </span>
        )}
      </button>

      {isOpen && (
        <div className="space-y-4">
          {/* Error state */}
          {status === "error" && (
            <div className="border border-red-300 dark:border-red-700 rounded-xl p-6 bg-red-50 dark:bg-red-950">
              <p className="text-red-600 dark:text-red-400 font-medium mb-3">{error}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Linking / Loading state */}
          {(status === "linking" || status === "loading") && (
            <div className="border-2 border-blue-300 dark:border-blue-700 rounded-xl p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium mb-1">
                {status === "linking"
                  ? `Connecting to ${linkedInstitution}...`
                  : "Fetching transactions..."}
              </p>
              <p className="text-sm text-gray-500">This may take a moment</p>
            </div>
          )}

          {/* Success state */}
          {status === "success" && (
            <div className="border border-green-300 dark:border-green-700 rounded-xl p-6 bg-green-50 dark:bg-green-950">
              <p className="text-green-700 dark:text-green-400 font-medium">
                Connected to {linkedInstitution} — {transactionCount} transactions loaded
              </p>
            </div>
          )}

          {/* Idle state - show connect button */}
          {status === "idle" && (
            <>
              <button
                onClick={() => open()}
                disabled={!ready}
                className="w-full border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-lg font-medium mb-2">
                  {ready ? "Connect Your Bank Account" : "Initializing..."}
                </p>
                <p className="text-sm text-gray-500">
                  Securely link your bank via Plaid to import transactions
                </p>
              </button>

              <div className="text-center">
                <span className="text-gray-400 text-sm">or</span>
              </div>

              <button
                onClick={onLoadSample}
                className="w-full py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Load Sample Data
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
