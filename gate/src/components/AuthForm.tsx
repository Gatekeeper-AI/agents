"use client";

import React, { useState } from "react";
import { useTurnkey } from "@turnkey/sdk-react";
import { DEFAULT_SOLANA_ACCOUNTS, TurnkeySDKApiTypes } from "@turnkey/sdk-browser";

const AuthForm = () => {
  const { turnkey, authIframeClient } = useTurnkey();
  const [email, setEmail] = useState<string>("");
  const [emailSubmitted, setEmailSubmitted] = useState<boolean>(false);

  const handleSubmit = async () => {
    let userOrgId = "";
    const subOrgIds = (await turnkey?.serverSign("getSubOrgIds", [
      {
        filterType: "EMAIL",
        filterValue: email,
      },
    ])) as TurnkeySDKApiTypes.TGetSubOrgIdsResponse;

    const { organizationIds } = subOrgIds;

    if (!organizationIds || organizationIds.length === 0) {
      // User doesn't exist—create a suborg first
      const subOrg = (await turnkey?.serverSign("createSubOrganization", [
        {
          subOrganizationName: email,
          rootUsers: [
            {
              userName: email,
              userEmail: email,
              apiKeys: [],
              authenticators: [],
              oauthProviders: [],
            },
          ],
          rootQuorumThreshold: 1,
          wallet: {
            walletName: "Default Wallet",
            accounts: [...DEFAULT_SOLANA_ACCOUNTS],
          },
        },
      ])) as TurnkeySDKApiTypes.TCreateSubOrganizationResponse;
      const { subOrganizationId } = subOrg;
      userOrgId = subOrganizationId;
    } else {
      // Use the first id for now
      userOrgId = organizationIds[0];
    }

    const auth = await turnkey?.serverSign("emailAuth", [
      {
        email: email,
        targetPublicKey: authIframeClient?.iframePublicKey,
        organizationId: userOrgId,
        emailCustomization: {
          appName: "gatekeep",
          magicLinkTemplate: `${process.env.NEXT_PUBLIC_BASE_URL}/verify?email=${email}&credentialBundle=%s`,
        },
      },
    ]);
    if (auth) {
      setEmailSubmitted(true);
    } else {
      console.log("Error sending email");
    }
  };

  if (!authIframeClient) {
    return null;
  }

  return (
    <>
      {emailSubmitted ? (
        <div className="flex items-center justify-center space-x-2 p-4 bg-white border border-gray-200 rounded-lg shadow-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-500 font-semibold">
            Check your email for the next steps
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <input
              onChange={(evt) => setEmail(evt.target.value)}
              type="email"
              placeholder="example@gmail.com"
              className="w-full p-3 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              disabled={!email}
              onClick={handleSubmit}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-white rounded-full border border-green-200 flex items-center justify-center hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export { AuthForm };
