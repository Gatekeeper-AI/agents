// app/layout.tsx
"use client";

import "./globals.css";
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';


export default function RootLayout({ children }: { children: React.ReactNode }) {

  const solanaConnectors = toSolanaWalletConnectors({
    shouldAutoConnect: true,
  });
  
  return (
    <html lang="en">
      <body className="bg-black text-[#00FF00] font-mono">
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
          config={{
            appearance: {
              theme: 'dark',
              accentColor: '#00FF00',
              walletChainType: "solana-only",
              logo: 'https://e7.pngegg.com/pngimages/779/61/png-clipart-logo-idea-cute-eagle-leaf-logo-thumbnail.png',
              walletList: [
                "phantom",
                "detected_wallets",
              ],
              
            },
            externalWallets: { solana: { connectors: solanaConnectors } },
            embeddedWallets: {
              requireUserPasswordOnCreate: false,
              showWalletUIs: true,
              ethereum: {
                "createOnLogin": "off"
              },
              solana: {
                "createOnLogin": "users-without-wallets"
              }
            }
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
