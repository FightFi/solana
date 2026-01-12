import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

// FIGHT Token Mint address
const FIGHT_TOKEN_MINT = new PublicKey("8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU");

describe("staking", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();

  const program = anchor.workspace.staking as Program<Staking>;

  // Test accounts
  let owner: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let fightTokenMint: PublicKey;
  let statePda: PublicKey;
  let vaultTokenAccount: PublicKey;
  let vaultAuthority: PublicKey;

  // Helper function to get PDA
  const getStatePda = async (): Promise<[PublicKey, number]> => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );
  };

  const getVaultAuthority = async (mint: PublicKey): Promise<[PublicKey, number]> => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), mint.toBuffer()],
      program.programId
    );
  };

  const getUserStakePda = async (user: PublicKey): Promise<[PublicKey, number]> => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), user.toBuffer()],
      program.programId
    );
  };

  before(async () => {
    // Generate test keypairs
    owner = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(
      owner.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      user1.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      user2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // For localnet, we'll create a test mint if needed
    // In production, you would use the actual FIGHT_TOKEN_MINT
    try {
      // Try to get the mint account info
      await provider.connection.getAccountInfo(FIGHT_TOKEN_MINT);
      fightTokenMint = FIGHT_TOKEN_MINT;
    } catch (error) {
      // If mint doesn't exist, create a test mint
      console.log("Creating test mint for localnet...");
      fightTokenMint = await createMint(
        provider.connection,
        owner,
        owner.publicKey,
        null,
        9 // 9 decimals
      );
    }

    // Get PDAs
    [statePda] = await getStatePda();
    [vaultAuthority] = await getVaultAuthority(fightTokenMint);
    vaultTokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      vaultAuthority,
      true
    );
  });

  it("Initializes the staking program", async () => {
    try {
      const tx = await program.methods
        .initialize(owner.publicKey)
        .accounts({
          state: statePda,
          fightTokenMint: fightTokenMint,
          vaultTokenAccount: vaultTokenAccount,
          vaultAuthority: vaultAuthority,
          payer: owner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      console.log("Initialize transaction signature", tx);

      // Verify state
      const state = await program.account.state.fetch(statePda);
      expect(state.fightTokenMint.toString()).to.equal(fightTokenMint.toString());
      expect(state.owner.toString()).to.equal(owner.publicKey.toString());
      expect(state.totalStaked.toNumber()).to.equal(0);
      expect(state.paused).to.equal(false);
    } catch (error) {
      // If already initialized, that's okay
      if (error.message.includes("already in use")) {
        console.log("Program already initialized, continuing...");
      } else {
        throw error;
      }
    }
  });

  it("Stakes tokens", async () => {
    const stakeAmount = new anchor.BN(1000 * 10 ** 9); // 1000 tokens with 9 decimals

    // Create user token account and mint tokens
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user1,
      fightTokenMint,
      user1.publicKey
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      owner,
      fightTokenMint,
      userTokenAccount.address,
      owner,
      stakeAmount.toNumber()
    );

    // Get user stake PDA
    const [userStakePda] = await getUserStakePda(user1.publicKey);

    // Stake tokens
    const tx = await program.methods
      .stake(stakeAmount)
      .accounts({
        state: statePda,
        userStake: userStakePda,
        user: user1.publicKey,
        userTokenAccount: userTokenAccount.address,
        vaultTokenAccount: vaultTokenAccount,
        vaultAuthority: vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    console.log("Stake transaction signature", tx);

    // Verify user stake
    const userStake = await program.account.userStake.fetch(userStakePda);
    expect(userStake.user.toString()).to.equal(user1.publicKey.toString());
    expect(userStake.balance.toNumber()).to.equal(stakeAmount.toNumber());

    // Verify state
    const state = await program.account.state.fetch(statePda);
    expect(state.totalStaked.toNumber()).to.equal(stakeAmount.toNumber());
  });

  it("Unstakes tokens", async () => {
    const unstakeAmount = new anchor.BN(500 * 10 ** 9); // 500 tokens

    // Get user token account
    const userTokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      user1.publicKey
    );

    // Get user stake PDA
    const [userStakePda] = await getUserStakePda(user1.publicKey);

    // Get balance before unstake
    const userStakeBefore = await program.account.userStake.fetch(userStakePda);
    const balanceBefore = userStakeBefore.balance.toNumber();

    // Unstake tokens
    const tx = await program.methods
      .unstake(unstakeAmount)
      .accounts({
        state: statePda,
        userStake: userStakePda,
        user: user1.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        vaultAuthority: vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    console.log("Unstake transaction signature", tx);

    // Verify user stake
    const userStake = await program.account.userStake.fetch(userStakePda);
    expect(userStake.balance.toNumber()).to.equal(balanceBefore - unstakeAmount.toNumber());

    // Verify state
    const state = await program.account.state.fetch(statePda);
    expect(state.totalStaked.toNumber()).to.equal(balanceBefore - unstakeAmount.toNumber());
  });

  it("Pauses the contract", async () => {
    const tx = await program.methods
      .pause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    console.log("Pause transaction signature", tx);

    // Verify state
    const state = await program.account.state.fetch(statePda);
    expect(state.paused).to.equal(true);
  });

  it("Fails to stake when paused", async () => {
    const stakeAmount = new anchor.BN(100 * 10 ** 9);

    // Get user token account
    const userTokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      user1.publicKey
    );

    // Get user stake PDA
    const [userStakePda] = await getUserStakePda(user1.publicKey);

    // Try to stake (should fail)
    try {
      await program.methods
        .stake(stakeAmount)
        .accounts({
          state: statePda,
          userStake: userStakePda,
          user: user1.publicKey,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenAccount,
          vaultAuthority: vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("ContractPaused");
    }
  });

  it("Unpauses the contract", async () => {
    const tx = await program.methods
      .unpause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    console.log("Unpause transaction signature", tx);

    // Verify state
    const state = await program.account.state.fetch(statePda);
    expect(state.paused).to.equal(false);
  });

  it("Fails to unstake more than balance", async () => {
    const [userStakePda] = await getUserStakePda(user1.publicKey);
    const userStake = await program.account.userStake.fetch(userStakePda);
    const unstakeAmount = new anchor.BN(userStake.balance.toNumber() + 1);

    const userTokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      user1.publicKey
    );

    try {
      await program.methods
        .unstake(unstakeAmount)
        .accounts({
          state: statePda,
          userStake: userStakePda,
          user: user1.publicKey,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenAccount,
          vaultAuthority: vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("InsufficientBalance");
    }
  });
});
