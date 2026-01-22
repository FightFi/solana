/**
 * Initialize the staking program on devnet
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import { PublicKey, Connection, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";

// Devnet configuration
const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5HWYY9fuyvCrvV66GCg5hPbf7XARCcybuQrdJGGEbEVH");
const FIGHT_MINT = new PublicKey("H5HwNswMvoHXHXqYuk1BkxXaiC3azj8gjy7qhwsdQLDt");
const WALLET_PATH = "~/.config/solana/testnet-wallet.json";

function loadWallet(): Keypair {
  const walletPath = WALLET_PATH.replace("~", os.homedir());
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(walletData));
}

async function main() {
  console.log("=".repeat(60));
  console.log("Initialize Staking Program on Devnet");
  console.log("=".repeat(60));

  const connection = new Connection(DEVNET_RPC_URL, "confirmed");
  const wallet = loadWallet();

  console.log(`\nWallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`FIGHT Mint: ${FIGHT_MINT.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`SOL Balance: ${(balance / 1e9).toFixed(4)} SOL`);

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

  // Derive State PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );
  console.log(`\nState PDA: ${statePda.toBase58()}`);

  // Check if already initialized
  try {
    const state = await (program.account as any).state.fetch(statePda);
    console.log("\nProgram already initialized!");
    console.log(`   Owner: ${state.owner.toBase58()}`);
    console.log(`   FIGHT Mint: ${state.fightTokenMint.toBase58()}`);
    console.log(`   Vault: ${state.vaultTokenAccount.toBase58()}`);
    console.log(`   Total Staked: ${state.totalStaked.toString()}`);
    console.log(`   Paused: ${state.paused}`);
    return;
  } catch (e) {
    console.log("\nProgram not yet initialized. Initializing now...");
  }

  // Initialize with priority fee for better confirmation
  try {
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 });

    const tx = await program.methods
      .initialize() // No args - owner is set to payer per [L-2] audit fix
      .accountsPartial({
        fightTokenMint: FIGHT_MINT,
        payer: wallet.publicKey,
      })
      .preInstructions([priorityFeeIx])
      .rpc({ commitment: "confirmed" });

    console.log(`\nInitialized! Tx: ${tx}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify initialization
    const state = await (program.account as any).state.fetch(statePda);
    console.log(`\n=== Initialized State ===`);
    console.log(`Owner: ${state.owner.toBase58()}`);
    console.log(`FIGHT Mint: ${state.fightTokenMint.toBase58()}`);
    console.log(`Vault: ${state.vaultTokenAccount.toBase58()}`);
    console.log(`Total Staked: ${state.totalStaked.toString()}`);
    console.log(`Paused: ${state.paused}`);
  } catch (e: any) {
    console.log(`\nInitialize failed: ${e.message}`);
    if (e.logs) {
      console.log("Logs:");
      e.logs.forEach((log: string) => console.log("  ", log));
    }
  }
}

main().catch(console.error);
