import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import BN from 'bn.js';
import {
  AuctionHouse,
  createDepositInstruction,
  createWithdrawInstruction,
} from '@metaplex-foundation/mpl-auction-house/dist/src/generated';
import { findAuctionHouseBuyerEscrowPda } from '@metaplex-foundation/js';

export const makeAHDepositWithdrawTx = async (
  connection: Connection,
  action: 'deposit' | 'withdraw',
  auctionHouse: string,
  owner: string,
  amountLamports: BN,
): Promise<{ tx: Transaction }> => {
  const auctionHouseKey = new PublicKey(auctionHouse);
  const ownerKey = new PublicKey(owner);

  const auctionHouseObj = await AuctionHouse.fromAccountAddress(
    connection,
    auctionHouseKey,
  );

  const escrowPaymentAccount = await findAuctionHouseBuyerEscrowPda(
    auctionHouseKey,
    ownerKey,
  );

  const ix =
    action === 'deposit'
      ? createDepositInstruction(
          {
            auctionHouse: auctionHouseKey,
            auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
            authority: auctionHouseObj.authority,
            escrowPaymentAccount,
            paymentAccount: ownerKey,
            transferAuthority: auctionHouseObj.authority, //as per OpenSea
            treasuryMint: auctionHouseObj.treasuryMint,
            wallet: ownerKey,
          },
          {
            amount: amountLamports,
            escrowPaymentBump: escrowPaymentAccount.bump,
          },
        )
      : createWithdrawInstruction(
          {
            auctionHouse: auctionHouseKey,
            auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
            authority: auctionHouseObj.authority,
            escrowPaymentAccount,
            receiptAccount: ownerKey,
            treasuryMint: auctionHouseObj.treasuryMint,
            wallet: ownerKey,
          },
          {
            amount: amountLamports,
            escrowPaymentBump: escrowPaymentAccount.bump,
          },
        );

  const tx = new Transaction().add(ix);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = ownerKey;

  return { tx };
};