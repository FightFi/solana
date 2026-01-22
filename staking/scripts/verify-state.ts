import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const PROGRAM_ID = new PublicKey("4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc");
  
  const provider = new anchor.AnchorProvider(connection, { publicKey: PublicKey.default } as any, {});
  const idl = require("../target/idl/staking.json");
  const program = new anchor.Program(idl, provider);
  
  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state")], PROGRAM_ID);
  const state = await (program.account as any).state.fetch(statePda);
  
  console.log("=== Mainnet State Account ===");
  console.log("State PDA:        ", statePda.toBase58());
  console.log("FIGHT Token Mint: ", state.fightTokenMint.toBase58());
  console.log("Owner:            ", state.owner.toBase58());
  console.log("Vault:            ", state.vaultTokenAccount.toBase58());
  console.log("Total Staked:     ", state.totalStaked.toString());
  console.log("Paused:           ", state.paused);
  
  const EXPECTED_MINT = "8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU";
  console.log("");
  console.log("=== Verification ===");
  console.log("Expected FIGHT Mint:", EXPECTED_MINT);
  console.log("Match:", state.fightTokenMint.toBase58() === EXPECTED_MINT ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
