/**
 * Initialize the staking program on Mainnet
 *
 * IMPORTANT: This script initializes the program with real funds.
 * Double-check all addresses before running!
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import { PublicKey, Connection, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";

// =============================================================================
// MAINNET CONFIGURATION - VERIFY BEFORE RUNNING!
// =============================================================================
const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";
const PROGRAM_ID = new PublicKey("4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc");
const FIGHT_MINT = new PublicKey("8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU");
const WALLET_PATH = "~/.config/solana/mainnet-wallet.json";

function loadWallet(): Keypair {
  const walletPath = WALLET_PATH.replace("~", os.homedir());
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(walletData));
}

async function main() {
  console.log("=".repeat(70));
  console.log("FIGHT Token Staking - MAINNET Initialization");
  console.log("=".repeat(70));
  console.log("\n⚠️  WARNING: This is MAINNET - real funds will be used!\n");

  const connection = new Connection(MAINNET_RPC_URL, "confirmed");
  const wallet = loadWallet();

  console.log("Configuration:");
  console.log(`  Wallet:     ${wallet.publicKey.toBase58()}`);
  console.log(`  Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`  FIGHT Mint: ${FIGHT_MINT.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`  SOL Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

  if (balance < 0.1 * 1e9) {
    console.log("❌ Insufficient SOL balance. Need at least 0.1 SOL.");
    return;
  }

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = new Program<Staking>(
    require("../target/idl/staking.json"),
    provider
  );

  // Verify program ID matches IDL
  if (program.programId.toBase58() !== PROGRAM_ID.toBase58()) {
    console.log("❌ Program ID mismatch!");
    console.log(`   IDL: ${program.programId.toBase58()}`);
    console.log(`   Expected: ${PROGRAM_ID.toBase58()}`);
    console.log("\nRebuild with: anchor build -- --features mainnet");
    return;
  }

  // Derive State PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );
  console.log(`State PDA: ${statePda.toBase58()}\n`);

  // Check if already initialized
  try {
    const state = await (program.account as any).state.fetch(statePda);
    console.log("✅ Program already initialized!");
    console.log(`   Owner: ${state.owner.toBase58()}`);
    console.log(`   FIGHT Mint: ${state.fightTokenMint.toBase58()}`);
    console.log(`   Vault: ${state.vaultTokenAccount.toBase58()}`);
    console.log(`   Total Staked: ${state.totalStaked.toString()}`);
    console.log(`   Paused: ${state.paused}`);
    return;
  } catch (e) {
    console.log("Program not yet initialized. Proceeding with initialization...\n");
  }

  // Confirm before proceeding
  console.log("=".repeat(70));
  console.log("READY TO INITIALIZE ON MAINNET");
  console.log("=".repeat(70));
  console.log("\nThis will:");
  console.log("  1. Create the State account");
  console.log("  2. Create the Vault token account");
  console.log(`  3. Set owner to: ${wallet.publicKey.toBase58()}`);
  console.log(`  4. Set FIGHT mint to: ${FIGHT_MINT.toBase58()}`);
  console.log("\nPress Ctrl+C within 5 seconds to cancel...\n");

  // Wait 5 seconds before proceeding
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("Initializing...\n");

  try {
    // Add priority fee for faster confirmation
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 });

    const tx = await program.methods
      .initialize()
      .accountsPartial({
        fightTokenMint: FIGHT_MINT,
        payer: wallet.publicKey,
      })
      .preInstructions([priorityFeeIx])
      .rpc({ commitment: "confirmed" });

    console.log("✅ INITIALIZED SUCCESSFULLY!");
    console.log(`\nTransaction: ${tx}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}`);

    // Verify initialization
    const state = await (program.account as any).state.fetch(statePda);
    console.log("\n=== Initialized State ===");
    console.log(`Owner: ${state.owner.toBase58()}`);
    console.log(`FIGHT Mint: ${state.fightTokenMint.toBase58()}`);
    console.log(`Vault: ${state.vaultTokenAccount.toBase58()}`);
    console.log(`Total Staked: ${state.totalStaked.toString()}`);
    console.log(`Paused: ${state.paused}`);

  } catch (e: any) {
    console.log("❌ Initialize failed:", e.message);
    if (e.logs) {
      console.log("\nTransaction logs:");
      e.logs.forEach((log: string) => console.log("  ", log));
    }
  }
}

main().catch(console.error);
