"use client"

import { useEffect } from "react";
import { useTurnkey } from "@turnkey/sdk-react";
import useUser from "../../hooks/useUser";
import "./loading.css";


export default function Page() {
  const { authIframeClient } = useTurnkey();
  const { login } = useUser();

  useEffect(() => {
    if (authIframeClient) {
      login();
    }
  }, [authIframeClient]);

  return (
    <main>
      <div className="flex w-full h-screen justify-center items-center">
        <div className="lds-dual-ring"></div>
      </div>
    </main>
  );
}