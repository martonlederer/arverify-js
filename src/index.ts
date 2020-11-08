import { query } from "./utils";
import txsQuery from "./queries/txs.gql";
import Arweave from "arweave";
import { readContract } from "smartweave";
import genesisQuery from "./queries/genesis.gql";
import tipQuery from "./queries/tip.gql";

// https://primer.style/octicons/shield-check-16
import verifiedIcon from "./icons/verified.svg";
// https://primer.style/octicons/shield-x-16
import unverifiedIcon from "./icons/unverified.svg";

// this value is in AR
export const FEE = 1;
// 0.9 -> 90%
export const COMMUNITY_PERCENT = 0.9;
export const COMMUNITY = "HWSbM2l-1gsBzCQMjzoP6G4aKafJvDeHyLs5YdTDxm0";

export const isVerified = async (addr: string): Promise<boolean> => {
  const verificationTxs = (
    await query({
      query: txsQuery,
      variables: {
        nodes: await getNodes(),
        addr,
      },
    })
  ).data.transactions.edges;

  return verificationTxs.length > 0;
};

export const icon = async (addr: string): Promise<string> => {
  const verified = await isVerified(addr);
  return verified ? verifiedIcon : unverifiedIcon;
};

export const getStake = async (addr: string): Promise<number> => {
  const client = new Arweave({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const state = await readContract(client, COMMUNITY);

  if (addr in state.vault) {
    // @ts-ignore
    return state.vault[addr].map((a) => a.balance).reduce((a, b) => a + b, 0);
  }
  return 0;
};

export const getNodes = async (): Promise<string[]> => {
  const genesisTxs = (
    await query({
      query: genesisQuery,
    })
  ).data.transactions.edges;

  const nodes: string[] = [];
  for (const tx of genesisTxs) {
    if (!nodes.find((addr) => addr === tx.node.owner.address)) {
      if ((await getStake(tx.node.owner.address)) > 0) {
        nodes.push(tx.node.owner.address);
      }
    }
  }

  return nodes;
};

export const tipReceived = async (
  addr: string,
  node: string
): Promise<boolean> => {
  if (!(node in (await getNodes()))) return false;

  const txs = (
    await query({
      query: tipQuery,
      variables: {
        owner: addr,
        recipient: node,
      },
    })
  ).data.transactions.edges;

  if (txs.length === 1) {
    return (
      parseFloat(txs[0].node.quantity.ar) === FEE * (1 - COMMUNITY_PERCENT)
    );
  }

  return false;
};
