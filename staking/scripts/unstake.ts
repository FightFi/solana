/**
 * Independent Unstake Script
 *
 * This script allows unstaking a specific amount of FIGHT tokens from the staking program.
 * It prints all involved accounts for transparency.
 *
 * Usage: npx ts-node scripts/unstake.ts [amount]
 * Example: npx ts-node scripts/unstake.ts 500
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import {
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, Connection, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// =============================================================================
// CONFIGURATION
// =============================================================================

const requiredEnvVars = ["PROGRAM_ID", "FIGHT_TOKEN_MINT", "SOLANA_RPC_URL", "WALLET_PRIVATE_KEY"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!.trim());
const FIGHT_MINT = new PublicKey(process.env.FIGHT_TOKEN_MINT!.trim());
const RPC_URL = process.env.SOLANA_RPC_URL!.trim();

// =============================================================================
// HELPERS
// =============================================================================

function loadWallet(): Keypair {
  const privateKeyString = process.env.WALLET_PRIVATE_KEY!.trim();
  try {
    const walletData = JSON.parse(privateKeyString);
    return Keypair.fromSecretKey(new Uint8Array(walletData));
  } catch (e) {
    return Keypair.fromSecretKey(anchor.utils.bytes.bs58.decode(privateKeyString));
  }
}

function formatTokens(amount: number | bigint): string {
  return (Number(amount) / 1e9).toFixed(2);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const amountArg = process.argv[2];
  if (!amountArg) {
    console.error("❌ Error: Please specify an amount to unstake.");
    console.log("Usage: npx ts-node scripts/unstake.ts [amount]");
    process.exit(1);
  }

  const amountToUnstake = parseFloat(amountArg);
  if (isNaN(amountToUnstake) || amountToUnstake <= 0) {
    console.error("❌ Error: Invalid amount specified.");
    process.exit(1);
  }

  const unstakeAmountRaw = new anchor.BN(amountToUnstake * 1e9);

  console.log("=".repeat(60));
  console.log(`FIGHT Token Staking - Unstake ${amountToUnstake} FIGHT`);
  console.log("=".repeat(60));

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = loadWallet();

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  
  const idl = require("../target/idl/staking.json");
  const program = new Program<Staking>(
    { ...idl, address: PROGRAM_ID.toBase58() },
    provider
  );

  // Derive PDAs
  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state")], PROGRAM_ID);
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("vault"), FIGHT_MINT.toBuffer()], PROGRAM_ID);
  const [userStakePda] = PublicKey.findProgramAddressSync([Buffer.from("user_stake"), wallet.publicKey.toBuffer()], PROGRAM_ID);

  const vaultTokenAccount = await getAssociatedTokenAddress(FIGHT_MINT, vaultAuthority, true);
  const userTokenAccount = await getAssociatedTokenAddress(FIGHT_MINT, wallet.publicKey);

  console.log("\n🔑 Accounts Involved:");
  console.log(`   Wallet:              ${wallet.publicKey.toBase58()}`);
  console.log(`   Program ID:          ${PROGRAM_ID.toBase58()}`);
  console.log(`   State PDA:           ${statePda.toBase58()}`);
  console.log(`   User Stake PDA:      ${userStakePda.toBase58()}`);
  console.log(`   Vault Authority:     ${vaultAuthority.toBase58()}`);
  console.log(`   Vault Token Account: ${vaultTokenAccount.toBase58()}`);
  console.log(`   User Token Account:  ${userTokenAccount.toBase58()}`);

  console.log("\n📊 Current Balances:");
  try {
    const userStakeAccount = await program.account.userStake.fetch(userStakePda);
    console.log(`   Your Staked Balance: ${formatTokens(userStakeAccount.balance.toNumber())} FIGHT`);
  } catch (e) {
    console.log(`   Your Staked Balance: 0 (No stake account found)`);
  }

  try {
    const userTokenBalance = await getAccount(connection, userTokenAccount);
    console.log(`   Your Wallet Balance: ${formatTokens(userTokenBalance.amount)} FIGHT`);
  } catch (e) {
    console.log(`   Your Wallet Balance: 0 (No token account found)`);
  }

  console.log(`\n📤 Executing unstake of ${amountToUnstake} FIGHT...`);

  try {
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 });
    
    const tx = await program.methods
      .unstake(unstakeAmountRaw)
      .accountsPartial({
        user: wallet.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
      })
      .preInstructions([priorityFeeIx])
      .rpc();

    console.log(`\n✅ Unstake Successful!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   View on explorer: https://explorer.solana.com/tx/${tx}?cluster=testnet`);

    // Fetch final balance
    const updatedUserStake = await program.account.userStake.fetch(userStakePda);
    console.log(`\n📊 Updated Staked Balance: ${formatTokens(updatedUserStake.balance.toNumber())} FIGHT`);

  } catch (e: any) {
    console.error(`\n❌ Unstake Failed: ${e.message}`);
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
