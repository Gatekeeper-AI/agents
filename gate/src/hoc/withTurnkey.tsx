import { Turnkey, TurnkeyIframeClient } from "@turnkey/sdk-browser";
import { useTurnkey } from "@turnkey/sdk-react";
import React from "react";

const withTurnkey = (WrappedComponent: React.ComponentType<any>) => {
  return function WithTurnkey(props : {}) {
    const { turnkey, authIframeClient } = useTurnkey();

    return (
      <WrappedComponent
        {...props}
        turnkey={turnkey as Turnkey}
        authIframeClient={authIframeClient as TurnkeyIframeClient}
      />
    );
  };
};

export default withTurnkey;