  ## Script Overview

  ### Setup (Steps 1-3)

  - **Step 1:** Connects to testnet and loads your wallet
  - **Step 2:** Sets up Anchor with your wallet as the signer
  - **Step 3:** Derives all PDAs (State, Vault, UserStake)

  ### PDAs Explained

  | PDA | Seeds | Purpose |
  |-----|-------|---------|
  | **State** | `["state"]` | Global config (owner, total staked, paused) |
  | **Vault Authority** | `["vault", mint]` | Controls the token vault |
  | **UserStake** | `["user_stake", user]` | Your personal staked balance |

  ### Main Flow (Steps 4-10)

  - **Step 4-5:** Checks if program initialized, initializes if not
  - **Step 6:** Shows your token balance before staking
  - **Step 7:** Stakes 1000 FIGHT tokens (wallet → vault)
  - **Step 8:** Verifies the stake worked
  - **Step 9:** Unstakes 500 FIGHT tokens (vault → wallet)
  - **Step 10:** Shows final balances

  ### Run It

  ```bash
  cd /Users/aukaitirrell/Projects/solana/staking
  npx ts-node scripts/testnet-demo.ts

  The script will output explorer links for each transaction so you can verify on-chain.
  ```