import { loanContract, bid, lockId, account } from "../../generated/schema";
import {
  ContractOpened as ContractOpenedEvent,
  ContractActive as ContractActiveEvent,
  ContractClosed as ContractClosedEvent,
  Liquidate as LiquidateEvent,
  LoanRepaid as LoanRepaidEvent,
  LostBid as LostBidEvent,
  BidOpened as BidOpenedEvent,
  BidClosed as BidClosedEvent,
  UpdateProtocolFees as UpdateProtocolFeesEvent,
} from "../../generated/P2PLending/P2PLending";
import { constants, transactions } from "../graphprotcol-utls";
import { updateProtocol, updateProtocolParameters } from "./main";
import { setAccountRevenue } from "../utils/erc721";
import { Address } from "@graphprotocol/graph-ts";

export function handleContractOpened(event: ContractOpenedEvent): void {
  let entity = new loanContract(event.params.id.toHexString());
  entity.borrower = event.params.borrower;
  entity.amount = event.params.amount;
  entity.interest = event.params.interest;
  entity.status = "PENDING";
  entity.expiry = event.params.expiry;
  entity.transaction = transactions.log(event).id;
  let tokenLockerEntity = lockId.load(event.params.lockId.toHexString());
  if (tokenLockerEntity != null) {
    tokenLockerEntity.contract = event.params.id.toHexString();
    tokenLockerEntity.save();
  }
  entity.save();
}

export function handleContractActive(event: ContractActiveEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.lender = event.params.lender;
    entity.status = "ACTIVE";
    entity.interest = event.params.interest;
    entity.expiry = event.params.expiry;
    entity.checkPointBlock = event.params.checkPointBlock;
    let bidEntity = bid.load(
      event.params.id
        .toHexString()
        .concat("-")
        .concat(event.params.lender.toHexString())
    );
    if (bidEntity != null) {
      bidEntity.status = "ACCEPTED";
      bidEntity.save();
    }
    updateProtocol(
      Address.fromString(constants.P2P),
      entity.amount,
      constants.BIGINT_ZERO
    );
    entity.save();
  }
}

export function handleContractClosed(event: ContractClosedEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "CLOSED";
    entity.save();
  }
}

export function handleLiquidation(event: LiquidateEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "LIQUIDATED";
    entity.save();
  }
}

export function handleLoansRepaid(event: LoanRepaidEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "LOAN_REPAID";
    updateProtocol(
      Address.fromString(constants.P2P),
      constants.BIGINT_ZERO,
      event.params.repaidInterest
    );
    entity.save();
  }
}

export function handleNewBid(event: BidOpenedEvent): void {
  let entity = new bid(
    event.params.id
      .toHexString()
      .concat("-")
      .concat(event.params.bidder.toHexString())
  );
  entity.bidder = event.params.bidder;
  entity.proposedInterest = event.params.proposedInterest;
  entity.transaction = transactions.log(event).id;
  entity.contract = event.params.id.toHexString();
  entity.status = "PENDING";
  entity.save();
}

export function handleLostBid(event: LostBidEvent): void {
  let bidder = event.params.bidder;
  let entity = bid.load(
    event.params.id
      .toHexString()
      .concat("-")
      .concat(bidder.toHexString())
  );
  let revenueAccount = setAccountRevenue(bidder);
  revenueAccount.withdrawableBid = revenueAccount.withdrawableBid.plus(
    event.params.amount
  );
  revenueAccount.save();
  if (entity != null) {
    entity.status = "REJECTED";
    entity.save();
  }
}

export function handleCancelledBid(event: BidClosedEvent): void {
  let entity = bid.load(
    `${event.params.id.toHexString()}-${event.params.bidder.toHexString()}`
  );
  2;
  if (entity != null) {
    entity.status = "CANCELLED";
    entity.save();
  }
}

export function handleProtocolFeeUpdate(event: UpdateProtocolFeesEvent): void {
  updateProtocolParameters(
    Address.fromString(constants.P2P),
    event.params.securityFee,
    event.params.protocolFee
  );
}

// Path: src\contracts\p2plending.ts
