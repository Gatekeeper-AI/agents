const { Turnkey } = require("@turnkey/sdk-server");
import { turnkeyConfig } from "@/config/turnkeyServer";
console.log("Turnkeyconfig" + turnkeyConfig)
const turnkeyServer = new Turnkey(turnkeyConfig);


import { NextApiResponse } from "next";
const proxyHandler = turnkeyServer.nextProxyHandler({
  allowedMethods: ["createSubOrganization", "getSubOrgIds", "emailAuth"],
});

export default function handler(req: any, res: NextApiResponse) {
  return proxyHandler(req, res);
}
