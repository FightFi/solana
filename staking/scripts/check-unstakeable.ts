// example: yarn check-balance FWfWF6dARm8Rja29BFEdLZ53sghQThXQQ241ZzdRBM79
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const userAddressStr = process.argv[2];

  if (!userAddressStr) {
    console.error("Usage: npx ts-node scripts/check-unstakeable.ts <USER_ADDRESS>");
    process.exit(1);
  }

  let userAddress: PublicKey;
  try {
    userAddress = new PublicKey(userAddressStr);
  } catch (err) {
    console.error("Invalid Solana address:", userAddressStr);
    process.exit(1);
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const programIdStr = process.env.PROGRAM_ID || "5HWYY9fuyvCrvV66GCg5hPbf7XARCcybuQrdJGGEbEVH";
  const programId = new PublicKey(programIdStr);

  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, { publicKey: PublicKey.default } as any, {});
  
  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/staking.json");
  const idl = require(idlPath);
  const program = new anchor.Program(idl, provider);

  // Derive UserStake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userAddress.toBuffer()],
    programId
  );

  console.log(`\n=== Staking Query ===`);
  console.log(`Network:     ${process.env.SOLANA_NETWORK || "devnet"}`);
  console.log(`RPC URL:     ${rpcUrl}`);
  console.log(`Program ID:  ${programId.toBase58()}`);
  console.log(`User:        ${userAddress.toBase58()}`);
  console.log(`UserStake:   ${userStakePda.toBase58()}`);
  console.log(`=====================\n`);

  try {
    const userStakeAccount = await (program.account as any).userStake.fetch(userStakePda);
    const balance = userStakeAccount.balance;
    
    // Format balance with 9 decimals
    const balanceFormatted = (Number(balance) / 1e9).toLocaleString(undefined, {
      minimumFractionDigits: 9,
      maximumFractionDigits: 9,
    });
    
    console.log(`Unstakeable Balance: ${balanceFormatted} FIGHT`);
    console.log(`(Raw units: ${balance.toString()})`);
    
  } catch (err: any) {
    if (err.message && err.message.includes("Account does not exist")) {
      console.log("\nUnstakeable Balance: 0 (No user stake account found)");
    } else {
      console.error("Error fetching user stake account:", err.message);
    }
  }
}

main().catch(console.error);
