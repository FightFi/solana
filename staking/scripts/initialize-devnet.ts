/**
 * Initialize the staking program on devnet
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Staking } from "../target/types/staking";

const DEVNET_FIGHT_MINT = new PublicKey("H5HwNswMvoHXHXqYuk1BkxXaiC3azj8gjy7qhwsdQLDt");

async function main() {
  // Configure the client to use devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Staking as Program<Staking>;
  const payer = provider.wallet;

  console.log("Program ID:", program.programId.toBase58());
  console.log("Payer:", payer.publicKey.toBase58());
  console.log("FIGHT Token Mint:", DEVNET_FIGHT_MINT.toBase58());

  // Derive State PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );

  console.log("\nState PDA:", statePda.toBase58());

  // Check if already initialized
  try {
    const stateAccount = await program.account.state.fetch(statePda);
    console.log("\n⚠️  Program already initialized!");
    console.log("Owner:", stateAccount.owner.toBase58());
    console.log("FIGHT Mint:", stateAccount.fightTokenMint.toBase58());
    console.log("Total Staked:", stateAccount.totalStaked.toString());
    console.log("Paused:", stateAccount.paused);
    return;
  } catch (e) {
    // State account doesn't exist, proceed with initialization
  }

  console.log("\nInitializing staking program...");

  try {
    const tx = await program.methods
      .initialize(payer.publicKey)
      .accounts({
        fightTokenMint: DEVNET_FIGHT_MINT,
        payer: payer.publicKey,
      })
      .rpc();

    console.log("✅ Initialization successful!");
    console.log("Transaction signature:", tx);
  } catch (e) {
    console.error("❌ Initialization failed:", e);
    throw e;
  }
}

main().catch(console.error);
