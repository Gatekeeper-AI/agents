"use client";

import { useEffect, useState } from "react";
import useUser from "@/hooks/useUser";
import { withTurnkey } from "@/hoc";
import Card from "@/components/Card";
import AgentInteraction from "@/components/AgentInteraction";
import AgentsGenerator from "@/components/AgentsGenerator";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { TurnkeySigner } from "@turnkey/solana";

const SOLANA_RPC_URL = "https://api.devnet.solana.com"; 

const Dashboard = ({ turnkey, authIframeClient }: any) => {
  const { currentUser, wallets, getWallets } = useUser();
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [hasPaid, setHasPaid] = useState<boolean>(false);
  const [rate, SetRate] = useState<number>(0);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [agentsJson, setAgentsJson] = useState<any>(null);
  const [activeView, setActiveView] = useState<"agentInteraction" | "agentsGenerator">("agentInteraction");

  useEffect(() => {
    if (currentUser && !wallets) {
      getWallets();
    }
  }, [currentUser]);

  useEffect(() => {
    if (wallets && wallets.length > 0) {
      setSolanaAddress(wallets[0]);
    }
  }, [wallets]);

  async function getBalance(
    address: string,
    network: "devnet" | "mainnet" = "devnet"
  ): Promise<number> {
    const endpoint =
      network === "devnet"
        ? clusterApiUrl("devnet")
        : clusterApiUrl("mainnet-beta");
    const connection = new Connection(endpoint, "confirmed");
    const lamports = await connection.getBalance(new PublicKey(address));
    return lamports / LAMPORTS_PER_SOL;
  }

  useEffect(() => {
    if (solanaAddress) {
      getBalance(solanaAddress, "devnet")
        .then((bal) => {
          setBalance(bal);
        })
        .catch((err) => {
          console.error("Error fetching balance", err);
        });
    }
  }, [solanaAddress]);

  if (!currentUser) {
    return <p className="text-center text-red-500 mt-10">Unauthorized</p>;
  }

  // Updated pay function accepts a destination address and an optional lamports amount.
  const pay = async (destinationAddress: string, lamports?: number) => {
    if (!solanaAddress) {
      alert("No Solana wallet found.");
      return;
    }

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");

    try {
      setLoading(true);
      const currentUser = await turnkey.getCurrentUser();
      if (!currentUser) throw new Error("User not authenticated");

      const signer = new TurnkeySigner({
        client: authIframeClient,
        organizationId: currentUser.organization.organizationId,
      });

      // Get the latest blockhash to ensure transaction validity
      const { blockhash } = await connection.getLatestBlockhash();

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(solanaAddress),
          toPubkey: new PublicKey(destinationAddress),
          // Use the provided amount or default to 10,000,000 lamports (~0.01 SOL)
          lamports: lamports || 10000000,
        })
      );

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(solanaAddress);

      // Sign the transaction with Turnkey
      const signedTransaction = await signer.signTransaction(
        transaction,
        solanaAddress
      );
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize()
      );
      console.log('sig' + signature)
      await connection.confirmTransaction(signature, "confirmed");

      setReceipt(signature);
      setHasPaid(true);
    } catch (error) {
      console.error("Transaction Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // This function fetches the agents.json from the provided URL and then makes the payment.
  const handleFetchAndPay = async () => {
    console.log("HERE")
    if (!websiteUrl.trim()) {
      alert("Please enter a valid website URL.");
      return;
    }
    setLoading(true);
    
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/get_json?url=${websiteUrl}&prompt=None`
      );
      console.log('heee' + response)
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      console.log(response)
      const data = await response.json();
      console.log('logger ' , data)
      setAgentsJson(data);

      // Extract the Solana address from the agents.json
      const destinationAddress = data.solana?.address;
      console.log('des addy: ', destinationAddress)
      if (!destinationAddress) {
        alert("Agents JSON does not contain a Solana address.");
        return;
      }
      let amount = 10000000; // fallback (0.01 SOL)
      if (data.solana?.rate) {
        // Maybe the rate is "0.20" stored in data.solana.rate, or you can hardcode it
        const solFloat = parseFloat("0.20"); // or parseFloat("0.20");
        const lamportsAsInteger = Math.round(solFloat * 1_000_000_000);
        amount = lamportsAsInteger;
      }
      

      await pay(destinationAddress, amount);
    } catch (error) {
      console.error("Error fetching agents.json and processing payment:", error);
      alert("Failed to fetch agents.json or process payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-100 space-y-6">
      {solanaAddress ? (
        <Card
          solanaAddress={solanaAddress}
          balance={balance}
          balanceUsd={0} // Update if you want to calculate/display USD value.
        />
      ) : (
        <p>Loading wallet...</p>
      )}

      {/* Toggle buttons for Agent Interaction and Agents Generator */}
      <div className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-lg">
        <div className="flex justify-center space-x-4 mb-4">
          <button
            onClick={() => setActiveView("agentInteraction")}
            className={`px-4 py-2 rounded-lg ${
              activeView === "agentInteraction"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            Agent Interaction
          </button>
          <button
            onClick={() => setActiveView("agentsGenerator")}
            className={`px-4 py-2 rounded-lg ${
              activeView === "agentsGenerator"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            Agents Generator
          </button>
        </div>

        {/* Render view based on active toggle */}
        {activeView === "agentInteraction" && (
          <>
            {!hasPaid ? (
              <div className="w-full max-w-md mx-auto">
                <h2 className="text-xl font-semibold text-gray-700 text-center mb-4">
                  Pay & Use Agent
                </h2>
                <input
                  type="text"
                  placeholder="Enter website URL"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <button
                  onClick={handleFetchAndPay}
                  disabled={loading}
                  className="w-full bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition"
                >
                  {loading ? "Processing..." : `Pay`}
                </button>
              </div>
            ) : (
              <AgentInteraction url={websiteUrl} agentsJson={agentsJson} />
            )}
          </>
        )}
        {activeView === "agentsGenerator" && (
          <AgentsGenerator solanaAddress= {solanaAddress || ""} />
        )}
      </div>
    </main>
  );
};

export default withTurnkey(Dashboard);
