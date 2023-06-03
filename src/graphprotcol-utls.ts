import { BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";

import { transaction } from "../generated/schema";

export namespace events {
  export function id(event: ethereum.Event): string {
    return event.block.number
      .toString()
      .concat("-")
      .concat(event.logIndex.toString());
  }
}

export namespace constants {
  export let BIGINT_ZERO = BigInt.fromI32(0);
  export let BIGINT_ONE = BigInt.fromI32(1);
  export let BIGDECIMAL_ZERO = new BigDecimal(constants.BIGINT_ZERO);
  export let BIGDECIMAL_ONE = new BigDecimal(constants.BIGINT_ONE);
  export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
  export const BYTES32_ZERO =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  export const Marketplace = "0xCbbDAdfdd3c19ce2183756D405F1Db2431C175c4";
  export const OfferHouse = "0x02847B9F9718803c9a057782E86037F5EdA359B7";
  export const Auction = "0x1D3001A0CdCb933bB5c04481773929c2c9Ffb4d1";
  export const WKCS = "0xd7f7c6465940cb246b43f4a09936b76a1e7e4409";
  export const TokenLocker = "0x7E2f9e264147883c397eB59e90Ad0947545387D9";
  export const P2P = "0x0214288D0B805e5eB1F67c4e2E5536f405198238";
  export const Collections = ["0x7257141509fed979fa2e97c7de475ab708eeda34", "0x9b43b2fc977690bf148bb9217e5a6dbc2c3d7419"];
}

export namespace transactions {
  export function log(event: ethereum.Event): transaction {
    let tx = transaction.load(event.transaction.hash.toHexString());
    if (!tx) {
      tx = new transaction(event.transaction.hash.toHexString());
      tx.timestamp = event.block.timestamp.toI32();
      tx.blockNumber = event.block.number.toI32();
      tx.unmatchedTransferCount = 0;
      tx.gasPrice = event.transaction.gasPrice;
      tx.transactionFrom = event.transaction.from;
      tx.transfers = new Array<string>();
      tx.save();
    }

    return tx as transaction;
  }
  export type Tx = transaction;
}
