import { makeMEHeaders, METxSigned, ME_AH_ADDRESS, ME_URL } from './shared';
import Big from 'big.js';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export const makeMEDelistTx = async ({
  tokenMint,
  tokenOwner,
  priceLamports,
  apiKey,
}: {
  tokenMint: string;
  tokenOwner: string;
  priceLamports: Big;
  apiKey: string;
}): Promise<METxSigned> => {
  const price = priceLamports.div(LAMPORTS_PER_SOL).toNumber();

  const tokenAccount = await getAssociatedTokenAddress(
    new PublicKey(tokenMint),
    new PublicKey(tokenOwner),
  );

  const { data } = await axios({
    url: `${ME_URL}/v2/instructions/sell_cancel`,
    method: 'GET',
    params: {
      seller: tokenOwner,
      auctionHouseAddress: ME_AH_ADDRESS,
      tokenMint,
      tokenAccount: tokenAccount.toBase58(),
      price, //yes have to pass actual listing price - random number doesn't work
      expiry: '-1',
    },
    headers: makeMEHeaders(apiKey),
  });

  return data.txSigned.data;
};
