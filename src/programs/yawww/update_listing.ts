import BN from 'bn.js';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  MARKET_PROGRAM_ID,
  MARKET_SCHEMA,
  UpdateListingInstructionData,
} from './state';
import { findListingAuthAccountPda } from './shared';
import { serialize } from 'borsh';
import { buildTx } from '../../solana_contrib';

export const makeYawwwUpdateListingTx = async (
  connections: Array<Connection>,
  seller: string,
  listing: string,
  priceLamports: BN,
  creatorShare?: number,
  optionalShare?: number,
): Promise<{ tx: Transaction }> => {
  const connection = connections[0];
  const instructions: TransactionInstruction[] = [];
  const additionalSigners: Keypair[] = [];

  const sellerAccount = new PublicKey(seller);
  const listingAccAddr = new PublicKey(listing);

  const [listingAuthorityAccount] = await findListingAuthAccountPda(
    listingAccAddr,
  );

  const data = Buffer.from(
    serialize(
      MARKET_SCHEMA,
      new UpdateListingInstructionData({
        price: priceLamports, //: price ?? listing.price,
        creator_share: creatorShare, // : creatorShare ?? listing.creator_share,
        optional_share: optionalShare, // : optionalShare ?? listing.optional_share,
      }),
    ),
  );

  const instructionAccounts = [
    ///   0. `[signer]` Buyer's wallet account
    {
      pubkey: sellerAccount,
      isSigner: true,
      isWritable: true,
    },
    ///   2. `[writable]` Listing account in open state
    {
      pubkey: listingAccAddr,
      isSigner: false,
      isWritable: true,
    },
    ///   9. `[]` Listing authority PDA [LISTING_AUTH_PREFIX, listing key]
    {
      pubkey: listingAuthorityAccount,
      isSigner: false,
      isWritable: false,
    },
    ///  10. `[]` Rent sysvar
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ///  13. `[]` System program
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];

  const transactionInstruction = new TransactionInstruction({
    programId: MARKET_PROGRAM_ID,
    keys: instructionAccounts,
    data,
  });

  instructions.push(transactionInstruction);

  return {
    tx: await buildTx({
      connections,
      instructions,
      additionalSigners,
      feePayer: sellerAccount,
    }),
  };
};
