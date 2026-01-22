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

describe("staking", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const program = anchor.workspace.staking as Program<Staking>;

  // Test accounts
  // Owner uses the provider wallet (matches EXPECTED_OWNER in constants.rs) [L-2]
  const owner = (provider.wallet as anchor.Wallet).payer;
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
    // Generate test keypairs (owner uses provider wallet - see above)
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Airdrop SOL to test accounts (owner/provider wallet is pre-funded)
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

    // Create a test mint for localnet testing
    console.log("Creating test FIGHT token mint...");
    console.log("Owner (EXPECTED_OWNER):", owner.publicKey.toString());
    fightTokenMint = await createMint(
      provider.connection,
      owner,
      owner.publicKey,
      null,
      9 // 9 decimals
    );

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
      // Note: No owner parameter - payer becomes owner (audit fix [L-2] [I-3])
      const tx = await program.methods
        .initialize()
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
        vaultAuthority: vaultAuthority,
        vaultTokenAccount: vaultTokenAccount,
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
        vaultAuthority: vaultAuthority,
        vaultTokenAccount: vaultTokenAccount,
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
          vaultAuthority: vaultAuthority,
          vaultTokenAccount: vaultTokenAccount,
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
          vaultAuthority: vaultAuthority,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("InsufficientBalance");
    }
  });

  // ============================================
  // SECURITY TESTS - Critical for production
  // ============================================

  it("Allows unstaking while paused (critical for user safety)", async () => {
    // First, pause the contract
    await program.methods
      .pause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    // Verify paused
    let state = await program.account.state.fetch(statePda);
    expect(state.paused).to.equal(true);

    const unstakeAmount = new anchor.BN(100 * 10 ** 9); // 100 tokens

    const userTokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      user1.publicKey
    );

    const [userStakePda] = await getUserStakePda(user1.publicKey);
    const userStakeBefore = await program.account.userStake.fetch(userStakePda);
    const balanceBefore = userStakeBefore.balance.toNumber();

    // Unstake should succeed even when paused
    const tx = await program.methods
      .unstake(unstakeAmount)
      .accounts({
        state: statePda,
        userStake: userStakePda,
        user: user1.publicKey,
        userTokenAccount: userTokenAccount,
        vaultAuthority: vaultAuthority,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    console.log("Unstake while paused transaction signature", tx);

    // Verify unstake succeeded
    const userStakeAfter = await program.account.userStake.fetch(userStakePda);
    expect(userStakeAfter.balance.toNumber()).to.equal(balanceBefore - unstakeAmount.toNumber());

    // Unpause for subsequent tests
    await program.methods
      .unpause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();
  });

  it("Fails when non-owner tries to pause", async () => {
    try {
      await program.methods
        .pause()
        .accounts({
          state: statePda,
          admin: user1.publicKey, // user1 is not the owner
        })
        .signers([user1])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("Unauthorized");
    }
  });

  it("Fails when non-owner tries to unpause", async () => {
    // First pause the contract
    await program.methods
      .pause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    try {
      await program.methods
        .unpause()
        .accounts({
          state: statePda,
          admin: user1.publicKey, // user1 is not the owner
        })
        .signers([user1])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("Unauthorized");
    }

    // Unpause for subsequent tests
    await program.methods
      .unpause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();
  });

  // ============================================
  // ERROR PATH TESTS
  // ============================================

  it("Fails to stake zero amount", async () => {
    const userTokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      user1.publicKey
    );

    const [userStakePda] = await getUserStakePda(user1.publicKey);

    try {
      await program.methods
        .stake(new anchor.BN(0))
        .accounts({
          state: statePda,
          userStake: userStakePda,
          user: user1.publicKey,
          userTokenAccount: userTokenAccount,
          vaultAuthority: vaultAuthority,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("ZeroAmount");
    }
  });

  it("Fails to unstake zero amount", async () => {
    const userTokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      user1.publicKey
    );

    const [userStakePda] = await getUserStakePda(user1.publicKey);

    try {
      await program.methods
        .unstake(new anchor.BN(0))
        .accounts({
          state: statePda,
          userStake: userStakePda,
          user: user1.publicKey,
          userTokenAccount: userTokenAccount,
          vaultAuthority: vaultAuthority,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("ZeroAmount");
    }
  });

  it("Fails to pause when already paused", async () => {
    // First pause
    await program.methods
      .pause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    // Try to pause again
    try {
      await program.methods
        .pause()
        .accounts({
          state: statePda,
          admin: owner.publicKey,
        })
        .signers([owner])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("AlreadyPaused");
    }

    // Unpause for subsequent tests
    await program.methods
      .unpause()
      .accounts({
        state: statePda,
        admin: owner.publicKey,
      })
      .signers([owner])
      .rpc();
  });

  it("Fails to unpause when not paused", async () => {
    // Contract should already be unpaused from previous test
    try {
      await program.methods
        .unpause()
        .accounts({
          state: statePda,
          admin: owner.publicKey,
        })
        .signers([owner])
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("NotPaused");
    }
  });

  // ============================================
  // FUNCTIONAL TESTS - Multiple users & edge cases
  // ============================================

  it("Tracks total_staked correctly with multiple users", async () => {
    // Get initial state
    const stateBefore = await program.account.state.fetch(statePda);
    const totalStakedBefore = stateBefore.totalStaked.toNumber();

    const stakeAmount = new anchor.BN(500 * 10 ** 9); // 500 tokens

    // Create user2 token account and mint tokens
    const user2TokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user2,
      fightTokenMint,
      user2.publicKey
    );

    // Mint tokens to user2
    await mintTo(
      provider.connection,
      owner,
      fightTokenMint,
      user2TokenAccount.address,
      owner,
      stakeAmount.toNumber()
    );

    // Get user2 stake PDA
    const [user2StakePda] = await getUserStakePda(user2.publicKey);

    // User2 stakes
    await program.methods
      .stake(stakeAmount)
      .accounts({
        state: statePda,
        userStake: user2StakePda,
        user: user2.publicKey,
        userTokenAccount: user2TokenAccount.address,
        vaultAuthority: vaultAuthority,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user2])
      .rpc();

    // Verify total_staked increased correctly
    const stateAfter = await program.account.state.fetch(statePda);
    expect(stateAfter.totalStaked.toNumber()).to.equal(totalStakedBefore + stakeAmount.toNumber());

    // Verify user2's individual balance
    const user2Stake = await program.account.userStake.fetch(user2StakePda);
    expect(user2Stake.balance.toNumber()).to.equal(stakeAmount.toNumber());

    // Verify user1's balance unchanged
    const [user1StakePda] = await getUserStakePda(user1.publicKey);
    const user1Stake = await program.account.userStake.fetch(user1StakePda);
    expect(user1Stake.balance.toNumber()).to.be.greaterThan(0); // user1 still has stake
  });

  it("Allows full unstake (withdraw entire balance)", async () => {
    const [user2StakePda] = await getUserStakePda(user2.publicKey);
    const user2StakeBefore = await program.account.userStake.fetch(user2StakePda);
    const fullBalance = user2StakeBefore.balance;

    const user2TokenAccount = await getAssociatedTokenAddress(
      fightTokenMint,
      user2.publicKey
    );

    const stateBefore = await program.account.state.fetch(statePda);
    const totalStakedBefore = stateBefore.totalStaked.toNumber();

    // Unstake full balance
    await program.methods
      .unstake(fullBalance)
      .accounts({
        state: statePda,
        userStake: user2StakePda,
        user: user2.publicKey,
        userTokenAccount: user2TokenAccount,
        vaultAuthority: vaultAuthority,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();

    // Verify user2 balance is now 0
    const user2StakeAfter = await program.account.userStake.fetch(user2StakePda);
    expect(user2StakeAfter.balance.toNumber()).to.equal(0);

    // Verify total_staked decreased
    const stateAfter = await program.account.state.fetch(statePda);
    expect(stateAfter.totalStaked.toNumber()).to.equal(totalStakedBefore - fullBalance.toNumber());
  });
});
