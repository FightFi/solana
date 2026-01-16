/**
 * Testnet Demo Script
 *
 * This script demonstrates the full staking flow on Solana testnet:
 * 1. Initialize the staking program (creates state + vault)
 * 2. Stake tokens (transfer from user → vault)
 * 3. Unstake tokens (transfer from vault → user)
 *
 * Prerequisites:
 * - Program deployed to testnet
 * - Token mint created
 * - Tokens minted to your wallet
 * - .env file configured
 *
 * Run with: npx ts-node scripts/testnet-demo.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// =============================================================================
// CONFIGURATION (loaded from .env)
// =============================================================================

// Validate required environment variables
const requiredEnvVars = ["PROGRAM_ID", "FIGHT_TOKEN_MINT", "SOLANA_RPC_URL", "WALLET_PATH"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Your deployed program ID
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

// Your FIGHT token mint
const FIGHT_MINT = new PublicKey(process.env.FIGHT_TOKEN_MINT!);

// RPC endpoint
const RPC_URL = process.env.SOLANA_RPC_URL!;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load wallet keypair from file
 * This reads your wallet that has SOL and FIGHT tokens
 * Path is configured in .env WALLET_PATH
 */
function loadWallet(): Keypair {
  // Expand ~ to home directory
  const walletPath = process.env.WALLET_PATH!.replace("~", os.homedir());
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(walletData));
}

/**
 * Derive the State PDA
 *
 * PDAs (Program Derived Addresses) are deterministic addresses owned by programs.
 * The State PDA stores global program data: owner, total staked, paused status.
 *
 * Seeds: ["state"]
 */
async function getStatePda(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );
}

/**
 * Derive the Vault Authority PDA
 *
 * The vault authority is a PDA that "owns" the vault token account.
 * Since PDAs have no private key, only our program can sign for it.
 * This is how the program controls the staked tokens.
 *
 * Seeds: ["vault", mint_pubkey]
 */
async function getVaultAuthority(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), FIGHT_MINT.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the UserStake PDA
 *
 * Each user gets their own PDA to track their staked balance.
 * This separates user data and allows parallel transactions.
 *
 * Seeds: ["user_stake", user_pubkey]
 */
async function getUserStakePda(user: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), user.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Format token amount for display (9 decimals)
 */
function formatTokens(amount: number | bigint): string {
  return (Number(amount) / 1e9).toFixed(2);
}

// =============================================================================
// MAIN SCRIPT
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("FIGHT Token Staking - Testnet Demo");
  console.log("=".repeat(60));

  // ---------------------------------------------------------------------------
  // STEP 1: Setup connection and wallet
  // ---------------------------------------------------------------------------
  console.log("\n📡 Connecting to Solana testnet...");

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = loadWallet();

  console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);

  // Check SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`   SOL Balance: ${(solBalance / 1e9).toFixed(4)} SOL`);

  // ---------------------------------------------------------------------------
  // STEP 2: Setup Anchor provider and program
  // ---------------------------------------------------------------------------
  console.log("\n🔧 Setting up Anchor...");

  // The provider combines connection + wallet for signing transactions
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load the program using IDL (Interface Definition Language)
  // The IDL describes all instructions, accounts, and types
  const program = new Program<Staking>(
    require("../target/idl/staking.json"),
    provider
  );

  console.log(`   Program ID: ${program.programId.toBase58()}`);

  // ---------------------------------------------------------------------------
  // STEP 3: Derive all PDAs we'll need
  // ---------------------------------------------------------------------------
  console.log("\n🔑 Deriving PDAs...");

  const [statePda] = await getStatePda();
  const [vaultAuthority] = await getVaultAuthority();
  const [userStakePda] = await getUserStakePda(wallet.publicKey);

  // The vault token account is an Associated Token Account (ATA)
  // ATAs are deterministic token accounts derived from owner + mint
  const vaultTokenAccount = await getAssociatedTokenAddress(
    FIGHT_MINT,
    vaultAuthority,
    true // allowOwnerOffCurve: true because vaultAuthority is a PDA
  );

  // User's token account (where their FIGHT tokens are)
  const userTokenAccount = await getAssociatedTokenAddress(
    FIGHT_MINT,
    wallet.publicKey
  );

  console.log(`   State PDA: ${statePda.toBase58()}`);
  console.log(`   Vault Authority: ${vaultAuthority.toBase58()}`);
  console.log(`   Vault Token Account: ${vaultTokenAccount.toBase58()}`);
  console.log(`   User Stake PDA: ${userStakePda.toBase58()}`);
  console.log(`   User Token Account: ${userTokenAccount.toBase58()}`);

  // ---------------------------------------------------------------------------
  // STEP 4: Check if program is already initialized
  // ---------------------------------------------------------------------------
  console.log("\n📋 Checking program state...");

  let isInitialized = false;
  try {
    const state = await program.account.state.fetch(statePda);
    isInitialized = true;
    console.log("   Program already initialized!");
    console.log(`   Owner: ${state.owner.toBase58()}`);
    console.log(`   Total Staked: ${formatTokens(state.totalStaked.toNumber())} FIGHT`);
    console.log(`   Paused: ${state.paused}`);
  } catch (e) {
    console.log("   Program not initialized yet");
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Initialize (if needed)
  // ---------------------------------------------------------------------------
  if (!isInitialized) {
    console.log("\n🚀 Initializing staking program...");
    console.log("   This creates:");
    console.log("   - State account (stores program config)");
    console.log("   - Vault token account (holds staked tokens)");

    try {
      const tx = await program.methods
        .initialize(wallet.publicKey) // Set ourselves as owner
        .accountsPartial({
          fightTokenMint: FIGHT_MINT,
          payer: wallet.publicKey,
        })
        .rpc();

      console.log(`   ✅ Initialized! Tx: ${tx}`);
      console.log(`   View on explorer: https://explorer.solana.com/tx/${tx}?cluster=testnet`);
    } catch (e: any) {
      console.log(`   ❌ Initialize failed: ${e.message}`);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Check user's token balance before staking
  // ---------------------------------------------------------------------------
  console.log("\n💰 Checking token balances...");

  const userAccount = await getAccount(connection, userTokenAccount);
  console.log(`   Your FIGHT balance: ${formatTokens(userAccount.amount)} FIGHT`);

  // ---------------------------------------------------------------------------
  // STEP 7: Stake tokens
  // ---------------------------------------------------------------------------
  const stakeAmount = new anchor.BN(1000 * 1e9); // 1000 tokens (with 9 decimals)

  console.log(`\n📥 Staking ${formatTokens(stakeAmount.toNumber())} FIGHT tokens...`);
  console.log("   This will:");
  console.log("   - Transfer tokens from your wallet → vault");
  console.log("   - Create/update your UserStake account");
  console.log("   - Update total_staked in State");

  try {
    const tx = await program.methods
      .stake(stakeAmount)
      .accountsPartial({
        user: wallet.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
      })
      .rpc();

    console.log(`   ✅ Staked! Tx: ${tx}`);
    console.log(`   View on explorer: https://explorer.solana.com/tx/${tx}?cluster=testnet`);
  } catch (e: any) {
    console.log(`   ❌ Stake failed: ${e.message}`);
    return;
  }

  // ---------------------------------------------------------------------------
  // STEP 8: Verify stake
  // ---------------------------------------------------------------------------
  console.log("\n📊 Verifying stake...");

  const userStake = await program.account.userStake.fetch(userStakePda);
  const state = await program.account.state.fetch(statePda);
  const userAccountAfterStake = await getAccount(connection, userTokenAccount);

  console.log(`   Your staked balance: ${formatTokens(userStake.balance.toNumber())} FIGHT`);
  console.log(`   Your wallet balance: ${formatTokens(userAccountAfterStake.amount)} FIGHT`);
  console.log(`   Total staked (all users): ${formatTokens(state.totalStaked.toNumber())} FIGHT`);

  // ---------------------------------------------------------------------------
  // STEP 9: Unstake tokens
  // ---------------------------------------------------------------------------
  const unstakeAmount = new anchor.BN(500 * 1e9); // 500 tokens

  console.log(`\n📤 Unstaking ${formatTokens(unstakeAmount.toNumber())} FIGHT tokens...`);
  console.log("   This will:");
  console.log("   - Transfer tokens from vault → your wallet");
  console.log("   - Update your UserStake balance");
  console.log("   - Update total_staked in State");

  try {
    const tx = await program.methods
      .unstake(unstakeAmount)
      .accountsPartial({
        user: wallet.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
      })
      .rpc();

    console.log(`   ✅ Unstaked! Tx: ${tx}`);
    console.log(`   View on explorer: https://explorer.solana.com/tx/${tx}?cluster=testnet`);
  } catch (e: any) {
    console.log(`   ❌ Unstake failed: ${e.message}`);
    return;
  }

  // ---------------------------------------------------------------------------
  // STEP 10: Final balances
  // ---------------------------------------------------------------------------
  console.log("\n📊 Final balances...");

  const finalUserStake = await program.account.userStake.fetch(userStakePda);
  const finalState = await program.account.state.fetch(statePda);
  const finalUserAccount = await getAccount(connection, userTokenAccount);

  console.log(`   Your staked balance: ${formatTokens(finalUserStake.balance.toNumber())} FIGHT`);
  console.log(`   Your wallet balance: ${formatTokens(finalUserAccount.amount)} FIGHT`);
  console.log(`   Total staked (all users): ${formatTokens(finalState.totalStaked.toNumber())} FIGHT`);

  // ---------------------------------------------------------------------------
  // DONE!
  // ---------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("✅ Demo complete!");
  console.log("=".repeat(60));
  console.log("\nSummary:");
  console.log(`   - Staked: ${formatTokens(stakeAmount.toNumber())} FIGHT`);
  console.log(`   - Unstaked: ${formatTokens(unstakeAmount.toNumber())} FIGHT`);
  console.log(`   - Net staked: ${formatTokens(finalUserStake.balance.toNumber())} FIGHT`);
}

// Run the script
main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
