"use client";

import './globals.css';
import { turnkeyConfig } from "@/config/turnkeyClient";
import { TurnkeyProvider } from "@turnkey/sdk-react";
import { SessionProvider } from "@/context/sessionContext";
import { ReactNode } from "react";

// const turnkeyConfig = {
//   apiBaseUrl: "https://api.turnkey.com",
//   defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID,
//   rpId: process.env.NEXT_PUBLIC_RPID, // e.g. your domain name
//   iframeUrl: "https://auth.turnkey.com",
//   serverSignUrl: process.env.NEXT_PUBLIC_SERVER_SIGN_URL || "http://localhost:3000/api",
// };

// export const metadata = {
//   title: "My Turnkey App",
//   description: "A demo project integrating Turnkey with React",
// };

export default function RootLayout({ children }: { children: ReactNode }) {
  {
    console.log('turnkeyConfig', turnkeyConfig)
    return (
      <html lang="en">
        <body>
          <TurnkeyProvider config={turnkeyConfig}>{children}</TurnkeyProvider>
        </body>
      </html>
    );
  }
}