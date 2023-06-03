import { loanContract, loanBid, lockId, account } from "../../generated/schema";
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
import { constants } from "../graphprotcol-utls";
import { Address } from "@graphprotocol/graph-ts";
import { fetchAccount, fetchAccountStatistics } from "../utils/erc721";
import { updateProtocolFeeParameters, updateProtocolLoanData, updateTxType } from "./marketplace";

export function handleContractOpened(event: ContractOpenedEvent): void {
  let entity = new loanContract(event.params.id.toHexString());
  entity.borrower = fetchAccount(event.params.borrower).id;
  entity.amount = event.params.amount;
  entity.interest = event.params.interest;
  entity.status = "PENDING";
  entity.expiry = event.params.expiry;
  entity.transaction = updateTxType(event, "LOAN_REQUEST_OPEN");
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
    let lender = fetchAccountStatistics(fetchAccount(event.params.lender).id)
    entity.lender = lender.id.toHexString();
    entity.status = "ACTIVE";
    entity.interest = event.params.interest;
    entity.expiry = event.params.expiry;
    entity.checkPointBlock = event.params.checkPointBlock;
    entity.transaction = updateTxType(event, "LOAN_REQUEST_ACTIVE")
    let bidEntity = loanBid.load(
      event.params.id
        .toHexString()
        .concat("-")
        .concat(lender.id.toHexString())
    );
    if (bidEntity != null) {
      bidEntity.status = "ACCEPTED";
      bidEntity.save();
    }
    updateProtocolLoanData(
      Address.fromString(constants.P2P),
      entity.amount,
      constants.BIGINT_ZERO
    );
    // Update borrower and lender loan data
    lender.loansFunded = lender.loansFunded + 1;
    let borrower = fetchAccountStatistics(entity.borrower)
    borrower.loansCount = borrower.loansCount + 1;

    lender.save()
    borrower.save()
    entity.save();
  }
}

export function handleContractClosed(event: ContractClosedEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "CLOSED";
    entity.transaction = updateTxType(event, "LOAN_REQUEST_CANCELLED")
    entity.save();
  }
}

export function handleLiquidation(event: LiquidateEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "LIQUIDATED";
    entity.transaction = updateTxType(event, "LOAN_LIQUIDATED")
    entity.save();
  }
}

export function handleLoansRepaid(event: LoanRepaidEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "LOAN_REPAID";
    let interest = event.params.repaidInterest
    updateProtocolLoanData(
      Address.fromString(constants.P2P),
      constants.BIGINT_ZERO,
      interest
    );
    let borrower = fetchAccountStatistics(entity.borrower)
    borrower.paidInterest = borrower.paidInterest.plus(interest)
    if(entity.lender != null){
      let lender = fetchAccountStatistics(entity.lender)
      lender.earnedInterest = lender.earnedInterest.plus(interest)
      lender.revenue = lender.revenue.plus(interest)
    }
    entity.transaction = updateTxType(event, "LOAN_REPAID")
    entity.save();
  }
}

export function handleNewBid(event: BidOpenedEvent): void {
  let entity = new loanBid(
    event.params.id
      .toHexString()
      .concat("-")
      .concat(event.params.bidder.toHexString())
  );
  entity.bidder = fetchAccount(event.params.bidder).id;
  entity.proposedInterest = event.params.proposedInterest;
  entity.transaction = updateTxType(event, "LOAN_REQUEST_BID_OPEN");
  entity.contract = event.params.id.toHexString();
  entity.status = "PENDING";
  entity.save();
}

export function handleLostBid(event: LostBidEvent): void {
  let bidder = event.params.bidder.toHexString();
  let entity = loanBid.load(
    event.params.id
      .toHexString()
      .concat("-")
      .concat(bidder)
  );
  let revenueAccount = fetchAccountStatistics(bidder);
  revenueAccount.withdrawableBid = revenueAccount.withdrawableBid.plus(
    event.params.amount
  );
  revenueAccount.save();
  if (entity != null) {
    entity.status = "REJECTED";
    entity.transaction = updateTxType(event, "LOAN_REQUEST_BID_LOST")
    entity.save();
  }
}

export function handleCancelledBid(event: BidClosedEvent): void {
  let entity = loanBid.load(
    `${event.params.id.toHexString()}-${event.params.bidder.toHexString()}`
  );
  2;
  if (entity != null) {
    entity.status = "CANCELLED";
    entity.transaction = updateTxType(event, "LOAN_REQUEST_BID_CANCELLED")
    entity.save();
  }
}

export function handleProtocolFeeUpdate(event: UpdateProtocolFeesEvent): void {
  updateProtocolFeeParameters(
    Address.fromString(constants.P2P),
    event.params.securityFee,
    event.params.protocolFee
  );
}

// Path: src\contracts\p2plending.ts
