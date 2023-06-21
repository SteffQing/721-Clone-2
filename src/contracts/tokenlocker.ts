import { BigInt } from "@graphprotocol/graph-ts";
import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
  Liquidate as LiquidateEvent,
} from "../../generated/TokenLocker/TokenLocker";
import { collection, lockId } from "../../generated/schema";
import { fetchAccount } from "../utils/erc721";
import { updateTxType } from "./marketplace";

export function handleDeposit(event: DepositEvent): void {
  let entity = new lockId(event.params.lockId.toHexString());
  entity.depositor = fetchAccount(event.params.user).id;
  entity.protocol = event.params.protocol;
  let _collection = event.params.collection.toHexString();
  entity.collection = _collection;
  entity.expires = event.params.lockPeriod;
  entity.status = "ACTIVE";
  let _lockedTokens = loopCollection(_collection, event.params.tokens);
  entity.tokens = _lockedTokens;
  entity.transaction = updateTxType(event, "TOKENS_LOCKED");
  entity.save();
}

export function loopCollection(collection: string, tokens: BigInt[]): string[] {
  let collectionTokens = tokens.length;
  let tokensArray: string[] = [];
  for (let j = 0; j < collectionTokens; j++) {
    let token = tokens[j];
    let tokenEntityId = `kcc/${collection}/${token}`;
    tokensArray.push(tokenEntityId);
  }
  return tokensArray;
}

export function handleWithdrawal(event: WithdrawEvent): void {
  let entity = lockId.load(event.params.lockId.toHexString());
  if (entity) {
    entity.status = "UNLOCKED";
    entity.save();
  }
}

export function handleLiquidation(event: LiquidateEvent): void {
  let entity = lockId.load(event.params.lockId.toHexString());
  if (entity) {
    entity.status = "LIQUIDATED";
    entity.depositor = fetchAccount(event.params.recipient).id;
    entity.save();
  }
}
