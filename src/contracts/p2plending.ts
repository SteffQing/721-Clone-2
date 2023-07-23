import {
  loanContract,
  loanBid,
  lockId,
  protocol,
  collectionLoanStatistic,
} from "../../generated/schema";
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
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { fetchAccount, fetchAccountStatistics } from "../utils/erc721";
import {
  updateProtocolFeeParameters,
  updateProtocolLoanData,
  updateTxType,
} from "./marketplace";

export function handleContractOpened(event: ContractOpenedEvent): void {
  let entity = new loanContract(event.params.id.toHexString());
  entity.borrower = fetchAccountStatistics(
    fetchAccount(event.params.borrower).id
  ).id.toHexString();
  entity.lender = constants.ADDRESS_ZERO;
  entity.amount = event.params.amount;
  entity.interest = event.params.interest;
  entity.status = "PENDING";
  entity.expiry = event.params.expiry;
  let transactions = entity.transactions;
  if (transactions == null) {
    transactions = [];
  }
  transactions.push(updateTxType(event, "LOAN_REQUEST_OPEN"));
  entity.transactions = transactions;
  let tokenLockerEntity = lockId.load(event.params.lockId.toHexString());
  if (tokenLockerEntity != null) {
    tokenLockerEntity.contract = event.params.id.toHexString();
    entity.collection = tokenLockerEntity.collection;
    tokenLockerEntity.save();
  }
  entity.save();
}

export function handleContractActive(event: ContractActiveEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    let lender = fetchAccountStatistics(fetchAccount(event.params.lender).id);
    entity.lender = lender.id.toHexString();
    entity.status = "ACTIVE";
    entity.interest = event.params.interest;
    entity.expiry = event.params.expiry;
    entity.checkPointBlock = event.params.checkPointBlock;
    let transactions = entity.transactions;
    if (transactions == null) {
      transactions = [];
    }
    transactions.push(updateTxType(event, "LOAN_REQUEST_ACTIVE"));
    entity.transactions = transactions;
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
    // Update borrower and lender loan data
    lender.lendCount = lender.lendCount + 1;
    lender.totalLentAmount = lender.totalLentAmount.plus(entity.amount);
    lender.points = lender.points + 20;
    let borrower = fetchAccountStatistics(entity.borrower);
    borrower.borrowCount = borrower.borrowCount + 1;
    borrower.totalBorrowedAmount = borrower.totalBorrowedAmount.plus(
      entity.amount
    );

    lender.save();
    borrower.save();
    entity.save();
  }
}

export function handleContractClosed(event: ContractClosedEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "CLOSED";
    let transactions = entity.transactions;
    if (transactions == null) {
      transactions = [];
    }
    transactions.push(updateTxType(event, "LOAN_REQUEST_CANCELLED"));
    entity.transactions = transactions;
    entity.save();
  }
}

export function handleLiquidation(event: LiquidateEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "LIQUIDATED";
    let transactions = entity.transactions;
    if (transactions == null) {
      transactions = [];
    }
    transactions.push(updateTxType(event, "LOAN_LIQUIDATED"));
    entity.transactions = transactions;
    let borrower = fetchAccountStatistics(entity.borrower);
    borrower.defaultCount = borrower.defaultCount + 1;
    let protocolEntity = protocol.load(
      Bytes.fromHexString(constants.P2P.toLowerCase())
    );
    let securityFee: BigInt = constants.BIGINT_ZERO;
    if (protocolEntity) {
      let _securityFee = BigInt.fromI32(protocolEntity.securityFee);
      securityFee = _securityFee.times(BigInt.fromI32(10));
    }
    let _securityFee = entity.amount.times(securityFee);
    let interest = _securityFee.div(BigInt.fromI32(10000));
    updateProtocolLoanData(
      Address.fromString(constants.P2P.toLowerCase()),
      entity.amount,
      interest
    );
    updateCollectionStats(entity.collection, entity.amount, interest);
    let lender = fetchAccountStatistics(entity.lender);
    lender.earnedInterest = lender.earnedInterest.plus(interest);
    lender.revenue = lender.revenue.plus(interest);
    lender.save();
    borrower.save();
    entity.save();
  }
}

export function handleLoansRepaid(event: LoanRepaidEvent): void {
  let entity = loanContract.load(event.params.id.toHexString());
  if (entity != null) {
    entity.status = "LOAN_REPAID";
    let interest = event.params.repaidInterest;
    updateProtocolLoanData(
      Address.fromString(constants.P2P.toLowerCase()),
      entity.amount,
      interest
    );
    updateCollectionStats(entity.collection, entity.amount, interest);
    let borrower = fetchAccountStatistics(entity.borrower);
    borrower.paidInterest = borrower.paidInterest.plus(interest);
    borrower.points = borrower.points + 20;
    borrower.save();
    let lender = fetchAccountStatistics(entity.lender);
    lender.earnedInterest = lender.earnedInterest.plus(interest);
    lender.revenue = lender.revenue.plus(interest);
    lender.save();
    let transactions = entity.transactions;
    if (transactions == null) {
      transactions = [];
    }
    transactions.push(updateTxType(event, "LOAN_REPAID"));
    entity.transactions = transactions;
    entity.save();
  }
}

export function handleNewBid(event: BidOpenedEvent): void {
  let id = event.params.id.toHexString();
  let bidder = event.params.bidder.toHexString();
  let entity = new loanBid(id.concat("-").concat(bidder));
  entity.bidder = fetchAccount(event.params.bidder).id;
  entity.proposedInterest = event.params.proposedInterest;
  let loanContractEntity = loanContract.load(id);
  if (loanContractEntity) {
    let transactions = loanContractEntity.transactions;
    if (transactions == null) {
      transactions = [];
    }
    transactions.push(updateTxType(event, "LOAN_REQUEST_BID_OPEN"));
    loanContractEntity.transactions = transactions;
    loanContractEntity.save();
  }
  entity.contract = id;
  entity.status = "PENDING";
  entity.save();
}

export function handleLostBid(event: LostBidEvent): void {
  let bidder = event.params.bidder.toHexString();
  let id = event.params.id.toHexString();
  let entity = loanBid.load(id.concat("-").concat(bidder));
  let revenueAccount = fetchAccountStatistics(bidder);
  revenueAccount.withdrawableBid = revenueAccount.withdrawableBid.plus(
    event.params.amount
  );
  revenueAccount.save();
  if (entity != null) {
    entity.status = "REJECTED";
    let loanContractEntity = loanContract.load(id);
    if (loanContractEntity) {
      let transactions = loanContractEntity.transactions;
      if (transactions == null) {
        transactions = [];
      }
      transactions.push(updateTxType(event, "LOAN_REQUEST_BID_LOST"));
      loanContractEntity.transactions = transactions;
      loanContractEntity.save();
    }
    entity.save();
  }
}

export function handleCancelledBid(event: BidClosedEvent): void {
  let id = event.params.id.toHexString();
  let entity = loanBid.load(`${id}-${event.params.bidder.toHexString()}`);
  2;
  if (entity != null) {
    entity.status = "CANCELLED";
    let loanContractEntity = loanContract.load(id);
    if (loanContractEntity) {
      let transactions = loanContractEntity.transactions;
      if (transactions == null) {
        transactions = [];
      }
      transactions.push(updateTxType(event, "LOAN_REQUEST_BID_CANCELLED"));
      loanContractEntity.transactions = transactions;
      loanContractEntity.save();
    }
    entity.save();
  }
}

export function handleProtocolFeeUpdate(event: UpdateProtocolFeesEvent): void {
  updateProtocolFeeParameters(
    Address.fromString(constants.P2P.toLowerCase()),
    event.params.securityFee,
    event.params.protocolFee
  );
}

function fetchCollectionStats(collection: string): collectionLoanStatistic {
  let _collection = Bytes.fromHexString(collection);
  let collectionEntity = new collectionLoanStatistic(_collection);
  collectionEntity.averageLoanAmount = constants.BIGDECIMAL_ZERO;
  collectionEntity.largestLoan = constants.BIGDECIMAL_ZERO;
  collectionEntity.totalLoanVolume = constants.BIGDECIMAL_ZERO;
  collectionEntity.totalLoanCount = 0;
  collectionEntity.totalPaidInterest = constants.BIGINT_ZERO;
  collectionEntity.collection = collection;
  collectionEntity.save();

  return collectionEntity as collectionLoanStatistic;
}
function updateCollectionStats(
  collection: string,
  amount: BigInt,
  interest: BigInt
): void {
  let _collection = Bytes.fromHexString(collection);
  let collectionEntity = collectionLoanStatistic.load(_collection);
  if (collectionEntity === null) {
    collectionEntity = fetchCollectionStats(collection);
  }
  let loanCount = collectionEntity.totalLoanCount;
  let loanAmount = amount.toBigDecimal();
  collectionEntity.totalLoanCount = loanCount + 1;
  collectionEntity.totalLoanVolume = collectionEntity.totalLoanVolume.plus(
    loanAmount
  );
  if (loanAmount.gt(collectionEntity.largestLoan)) {
    collectionEntity.largestLoan = loanAmount;
  }
  collectionEntity.averageLoanAmount = collectionEntity.totalLoanVolume.div(
    BigInt.fromI32(collectionEntity.totalLoanCount).toBigDecimal()
  );
  collectionEntity.totalPaidInterest = collectionEntity.totalPaidInterest.plus(
    interest
  );
  collectionEntity.save();
}

// Path: src\contracts\p2plending.ts
