// import { EtherscanProvider, formatEther } from "ethers";
import { NextApiResponse } from "next";

//@ts-expect-error needed for conversion from NextJS response to etherscan response
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export default async function handler(req: any, res: NextApiResponse) {
  const { address } = await req.body;
  // const provider = new EtherscanProvider(
  //   "sepolia",
  //   process.env.ETHERSCAN_API_KEY,
  // );
  // const balance = await provider.getBalance(`${address}`);
  res.status(200).json({ balance: 0 });
}
