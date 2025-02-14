import React from "react";

interface CardProps {
  solanaAddress: string;
  balance: number;      // Balance in SOL
  balanceUsd: number;
}

function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}

const Card: React.FC<CardProps> = ({ solanaAddress, balance, balanceUsd }) => {
  return (
    <div className="w-80 bg-gradient-to-r from-green-400 to-green-600 rounded-xl shadow-md p-6 text-white">
      <h2 className="text-xl font-bold">Wallet Balance</h2>
      {/* Display the balance in SOL */}
      <p className="text-3xl font-semibold my-2">{balance.toFixed(3)} SOL</p>
      {/* Optionally display USD value if available */}
      {balanceUsd > 0 && (
        <p className="text-sm">(${balanceUsd.toFixed(2)} USD)</p>
      )}
      <div className="mt-4">
        <p className="text-sm opacity-75">Solana Address</p>
        <p className="font-mono text-lg">{shortenAddress(solanaAddress)}</p>
      </div>
    </div>
  );
};

export default Card;
