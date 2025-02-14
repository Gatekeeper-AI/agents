// Header.tsx
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useLogin, usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { login } = useLogin({
    onComplete: () => console.log("success"),
  });
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useSolanaWallets();
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <header className="h-14 border-b px-4 flex items-center justify-between">
      <h1 className="text-sm font-medium">FreeAgent</h1>
      <div className="flex items-center gap-2">
        {ready && authenticated && user ? (
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {formatWalletAddress(wallets[0]?.address || '')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout}>
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" onClick={login}>
            Login
          </Button>
        )}
      </div>
    </header>
  );
}
