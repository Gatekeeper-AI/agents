import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { useLogin, usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserStore } from '@/store/useAuthStore';

const TOKEN_MINT_ADDRESS = process.env.CONTRACT_CA; 
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export function Header() {
  const { login } = useLogin({
    onComplete: () => console.log("success"),
  });
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useSolanaWallets();
  const [isOpen, setIsOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  const { setWalletAddress, setUserInfo } = useUserStore();
  const lastWalletAddress = useRef<string | null>(null); 
  const formatWalletAddress = (address: string) => {
    if (address && address.length > 10) {
      return `${address.slice(0, 5)}...${address.slice(-5)}`;
    }
    return address;
  };

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      const walletAddress = wallets[0].address;
      if (lastWalletAddress.current !== walletAddress) {
        setWalletAddress(walletAddress);
        lastWalletAddress.current = walletAddress; 
      }

      const checkTokenBalance = async () => {
        const response = await fetch(SOLANA_RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenAccountsByOwner",
            params: [walletAddress, { mint: TOKEN_MINT_ADDRESS }, { encoding: "jsonParsed" }],
          }),
        });

        const data = await response.json();
        console.log(data)
        const balance = data.result?.value?.[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;

        if (balance) {
          setTokenBalance(balance); // Update the token balance
          setUserInfo({ walletAddress, tokenBalance: balance }); // Store it in the global state
        } else {
          setTokenBalance(0);
        }
      };

      checkTokenBalance();
    }
  }, [authenticated, wallets, setWalletAddress, setUserInfo]);

  return (
    <header className="h-14 border-b px-4 flex items-center justify-between">
      <h1 className="text-sm font-medium">FreeAgent</h1>
      <div className="flex items-center gap-2">
        <div className='pr-9'>
        {tokenBalance !== null && `$${tokenBalance} Tokens`}
        </div>
        {ready && authenticated && user ? (
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {formatWalletAddress(wallets[0]?.address || '')} 
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout}>Disconnect</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" onClick={login}>Login</Button>
        )}
      </div>
    </header>
  );
}
