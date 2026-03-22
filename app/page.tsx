"use client";

import { useState, useCallback } from "react";
import { NormalizedTransaction, ColumnMapping, ParsedCSV, CardSimulationResult, AppCategory } from "@/lib/types";
import { parseCSVText, autoDetectColumns, isValidMapping } from "@/lib/csv/parser";
import { normalizeTransactions, deduplicateTransactions } from "@/lib/csv/normalizer";
import { loadCards } from "@/lib/cards/loader";
import { simulateAllCards } from "@/lib/rewards/simulator";
import { getCardCategory } from "@/lib/categorize/engine";
import UploadSection from "@/components/UploadSection";
import InsightsSection from "@/components/InsightsSection";
import TabsSection from "@/components/TabsSection";

// Sample CSV data inline for demo mode
const SAMPLE_CHASE = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2025,01/16/2025,KROGER #1234,Groceries,Sale,-85.43,
01/15/2025,01/16/2025,STARBUCKS STORE 5678,Food & Drink,Sale,-6.75,
01/17/2025,01/18/2025,SHELL OIL 98765,Gas,Sale,-45.20,
01/18/2025,01/19/2025,NETFLIX.COM,Entertainment,Sale,-15.99,
01/20/2025,01/21/2025,AMAZON.COM*MK1234,Shopping,Sale,-67.89,
01/22/2025,01/23/2025,CHIPOTLE ONLINE 4321,Food & Drink,Sale,-12.50,
01/25/2025,01/26/2025,UNITED AIRLINES 0012345,Travel,Sale,-342.00,
01/26/2025,01/27/2025,CVS/PHARMACY #8765,Health & Wellness,Sale,-23.45,
01/28/2025,01/29/2025,MARRIOTT HOTELS RES,Travel,Sale,-189.99,
01/30/2025,01/31/2025,COMCAST CABLE COMM,Bills & Utilities,Sale,-89.99,
02/01/2025,02/02/2025,WHOLE FOODS MKT #1234,Groceries,Sale,-112.34,
02/02/2025,02/03/2025,UBER TRIP,Travel,Sale,-24.50,
02/03/2025,02/04/2025,ONLINE PAYMENT - THANK YOU,Payment,Payment,500.00,
02/05/2025,02/06/2025,DOORDASH*DASHER,Food & Drink,Sale,-31.45,
02/07/2025,02/08/2025,TARGET 00012345,Merchandise,Sale,-54.32,
02/10/2025,02/11/2025,SPOTIFY USA,Entertainment,Sale,-10.99,
02/12/2025,02/13/2025,WALGREENS #5432,Health & Wellness,Sale,-18.75,
02/14/2025,02/15/2025,THE OLIVE GARDEN #123,Food & Drink,Sale,-48.67,
02/15/2025,02/16/2025,DELTA AIR LINES 0067890,Travel,Sale,-275.00,
02/18/2025,02/19/2025,HOME DEPOT #4567,Shopping,Sale,-156.78,
02/20/2025,02/21/2025,KROGER #1234,Groceries,Sale,-93.21,
02/22/2025,02/23/2025,AMC THEATRES #789,Entertainment,Sale,-32.00,
02/25/2025,02/26/2025,ZELLE TRANSFER TO JOHN,Transfer,Sale,-200.00,
03/01/2025,03/02/2025,TRADER JOES #456,Groceries,Sale,-78.90,
03/03/2025,03/04/2025,EXXONMOBIL 12345,Gas,Sale,-52.10,
03/05/2025,03/06/2025,BEST BUY #00789,Shopping,Sale,-299.99,
03/07/2025,03/08/2025,SOUTHWEST AIR 1234567,Travel,Sale,-198.00,
03/08/2025,03/09/2025,PANERA BREAD #234,Food & Drink,Sale,-15.25,
03/10/2025,03/11/2025,GEICO AUTO INSURANCE,Bills & Utilities,Sale,-145.00,
03/12/2025,03/13/2025,COSTCO WHSE #1234,Merchandise,Sale,-234.56,`;

const SAMPLE_BOA = `Date,Description,Debit,Credit
2025-01-14,SAFEWAY STORE #2345,92.15,
2025-01-16,MCDONALD'S F12345,8.99,
2025-01-18,CHEVRON GAS STATION,38.50,
2025-01-20,DISNEY+ SUBSCRIPTION,13.99,
2025-01-22,NORDSTROM #567,145.67,
2025-01-25,AMERICAN AIRLINES 0098765,425.00,
2025-01-28,HYATT REGENCY HOTEL,215.50,
2025-01-30,AT&T WIRELESS,85.00,
2025-02-01,PUBLIX SUPER MARKET,67.89,
2025-02-03,UBER EATS *DELIVERY,22.30,
2025-02-05,RITE AID #4321,15.99,
2025-02-07,TICKETMASTER EVENT,78.50,
2025-02-10,AUTOMATIC PAYMENT,,1200.00
2025-02-12,TRADER JOES #789,95.43,
2025-02-14,DUNKIN DONUTS #567,5.75,
2025-02-16,LYFT RIDE,18.25,
2025-02-18,AMAZON.COM*AB1234,89.99,
2025-02-20,VERIZON WIRELESS,95.00,
2025-02-22,WEGMANS FOOD MKT,134.56,
2025-02-24,APPLEBEES #345,35.80,
2025-02-26,HERTZ RENT-A-CAR,178.90,
2025-02-28,REFUND - NORDSTROM,,145.67
2025-03-02,HULU SUBSCRIPTION,17.99,
2025-03-04,WENDY'S #8765,9.45,
2025-03-06,CVS/PHARMACY #2345,27.50,
2025-03-08,SIX FLAGS TICKETS,65.00,
2025-03-10,VENMO PAYMENT,300.00,
2025-03-12,KROGER FUEL CENTER,41.25,
2025-03-14,SUSHI PALACE,42.00,
2025-03-15,STATE FARM INSURANCE,125.00,`;

export default function Home() {
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [simResults, setSimResults] = useState<CardSimulationResult[]>([]);
  const [uploadOpen, setUploadOpen] = useState(true);
  const [hasData, setHasData] = useState(false);

  const processTransactions = useCallback((txns: NormalizedTransaction[]) => {
    setTransactions(prev => {
      const deduped = deduplicateTransactions([...prev, ...txns]);
      const cards = loadCards();
      const results = simulateAllCards(cards, deduped);
      setSimResults(results);
      setHasData(true);
      setUploadOpen(false);
      return deduped;
    });
  }, []);

  const handleFilesProcessed = useCallback((txns: NormalizedTransaction[]) => {
    processTransactions(txns);
  }, [processTransactions]);

  const handleLoadSample = useCallback(() => {
    const parsed1 = parseCSVText(SAMPLE_CHASE, "chase_checking.csv");
    const mapping1 = autoDetectColumns(parsed1.headers);
    // Chase uses "Transaction Date" for date and "Description" for description, Amount for amount
    const fullMapping1: ColumnMapping = {
      date: mapping1.date || "Transaction Date",
      description: mapping1.description || "Description",
      amount: mapping1.amount || "Amount",
    };
    const txns1 = normalizeTransactions(parsed1, fullMapping1);

    const parsed2 = parseCSVText(SAMPLE_BOA, "bank_of_america.csv");
    const mapping2 = autoDetectColumns(parsed2.headers);
    const fullMapping2: ColumnMapping = {
      date: mapping2.date || "Date",
      description: mapping2.description || "Description",
      debit: mapping2.debit || "Debit",
      credit: mapping2.credit || "Credit",
    };
    const txns2 = normalizeTransactions(parsed2, fullMapping2);

    const all = deduplicateTransactions([...txns1, ...txns2]);
    setTransactions(all);
    const cards = loadCards();
    const results = simulateAllCards(cards, all);
    setSimResults(results);
    setHasData(true);
    setUploadOpen(false);
  }, []);

  const handleCategoryOverride = useCallback((txnId: string, newCategory: AppCategory) => {
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (t.id !== txnId) return t;
        return {
          ...t,
          app_category: newCategory,
          card_category: getCardCategory(newCategory),
          overridden: true,
        };
      });
      const cards = loadCards();
      const results = simulateAllCards(cards, updated);
      setSimResults(results);
      return updated;
    });
  }, []);

  const handleReset = useCallback(() => {
    setTransactions([]);
    setSimResults([]);
    setHasData(false);
    setUploadOpen(true);
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Credit Card Rewards Analyzer</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload your bank transactions to find the best credit card for your spending habits
        </p>
      </header>

      <UploadSection
        isOpen={uploadOpen}
        onToggle={() => setUploadOpen(!uploadOpen)}
        onFilesProcessed={handleFilesProcessed}
        onLoadSample={handleLoadSample}
        onReset={hasData ? handleReset : undefined}
      />

      {hasData && (
        <>
          <InsightsSection transactions={transactions} />
          <TabsSection
            transactions={transactions}
            simResults={simResults}
            onCategoryOverride={handleCategoryOverride}
          />
        </>
      )}
    </main>
  );
}
