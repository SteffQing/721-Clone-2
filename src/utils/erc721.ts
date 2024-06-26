import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { IERC721Metadata } from "../../generated/IERC721/IERC721Metadata";

import { Contract721 } from "../../generated/IERC721/Contract721";

import {
  account,
  accountStatistic,
  collection,
  contract,
  token,
} from "../../generated/schema";

import { supportsInterface } from "./erc165";

import { TokenMetadata as TokenMetadataTemplate } from "../../generated/templates";

import { constants } from "../graphprotcol-utls";

export function fetchRegistry(address: Address): collection {
  let erc721 = IERC721Metadata.bind(address);
  let Collection = Contract721.bind(address);
  let contractEntity = contract.load(address.toHexString());

  if (contractEntity == null) {
    contractEntity = new contract(address.toHexString());
    let introspection_01ffc9a7 = supportsInterface(erc721, "01ffc9a7"); // ERC165
    let introspection_80ac58cd = supportsInterface(erc721, "80ac58cd"); // ERC721
    let introspection_00000000 = supportsInterface(erc721, "00000000", false);
    let isERC721 =
      introspection_01ffc9a7 &&
      introspection_80ac58cd &&
      introspection_00000000;
    contractEntity.asERC721 = isERC721 ? contractEntity.id : null;
    contractEntity.save();
  }

  let collectionEntity = collection.load(contractEntity.id);
  if (collectionEntity == null) {
    collectionEntity = new collection(contractEntity.id);

    //contract calls
    let try_name = erc721.try_name();
    let try_symbol = erc721.try_symbol();
    let try_mintPrice = Collection.try_price();
    let try_owner = Collection.try_owner();
    let mintPriceBigInt = try_mintPrice.reverted
      ? BigInt.fromI32(0)
      : try_mintPrice.value;
    let mintPrice = mintPriceBigInt.divDecimal(
      BigDecimal.fromString("1000000000000000000")
    );

    collectionEntity.name = try_name.reverted ? "" : try_name.value;
    collectionEntity.symbol = try_symbol.reverted ? "" : try_symbol.value;
    collectionEntity.mintPrice = mintPrice;
    collectionEntity.creator = try_owner.reverted
      ? null
      : fetchAccount(try_owner.value).id;
    collectionEntity.supportsMetadata = supportsInterface(erc721, "5b5e139f"); // ERC721Metadata

    collectionEntity.save();
  }
  return collectionEntity as collection;
}

export function fetchToken(
  collection: collection,
  id: BigInt,
  timestamp: BigInt
): token {
  let tokenid = "eth/".concat(collection.id.concat("/").concat(id.toString()));
  let tokenEntity = token.load(tokenid);
  let timeout = BigInt.fromI32(2592000);
  let lastUpdate = tokenEntity
    ? tokenEntity.updatedAtTimestamp.plus(timeout)
    : BigInt.fromI32(0);
  if (tokenEntity == null || lastUpdate.lt(timestamp)) {
    let account_zero = new account(constants.ADDRESS_ZERO);
    account_zero.save();

    tokenEntity = new token(tokenid);
    tokenEntity.collection = collection.id;
    tokenEntity.tokenId = id.toString();

    //update collection's total supply
    let Collection = Contract721.bind(Address.fromString(collection.id));
    let try_totalSupply = Collection.try_totalSupply();
    let tokenURI = Collection.try_tokenURI(id);

    tokenEntity.tokenURI = tokenURI.reverted ? "" : tokenURI.value;
    tokenEntity.updatedAtTimestamp = timestamp;
    collection.totalSupply = try_totalSupply.reverted
      ? BigInt.fromI32(0)
      : try_totalSupply.value;
    if (tokenURI.reverted == false) {
      const tokenIpfsHash = tokenURI.value;
      let ipfsHash = checkUri(tokenIpfsHash);
      if (ipfsHash.length > 0) {
        let metaDataHash = ipfsHash + "/" + id.toString() + ".json";
        tokenEntity.metadata = metaDataHash;
        TokenMetadataTemplate.create(metaDataHash);
      }
    }
  }
  return tokenEntity as token;
}

export function fetchAccount(address: Address): account {
  let addressAccount = address.toHexString();
  let accountEntity = account.load(addressAccount);

  if (accountEntity == null && addressAccount != constants.ADDRESS_ZERO) {
    accountEntity = new account(address.toHexString());

    accountEntity.save();
  }
  return accountEntity as account;
}

export function fetchAccountStatistics(address: string): accountStatistic {
  let addressBytes = Address.fromString(address);
  let accountEntity = accountStatistic.load(addressBytes);
  if (accountEntity == null) {
    accountEntity = new accountStatistic(addressBytes);
    accountEntity.points = 0;
    accountEntity.paidInterest = constants.BIGINT_ZERO;
    accountEntity.earnedInterest = constants.BIGINT_ZERO;
    accountEntity.borrowCount = 0;
    accountEntity.lendCount = 0;
    accountEntity.defaultCount = 0;
    accountEntity.withdrawableBid = constants.BIGINT_ZERO;
    accountEntity.revenue = constants.BIGINT_ZERO;
    accountEntity.totalBorrowedAmount = constants.BIGINT_ZERO;
    accountEntity.totalLentAmount = constants.BIGINT_ZERO;
    accountEntity.account = fetchAccount(addressBytes).id;
    accountEntity.save();
  }
  return accountEntity;
}

function checkUri(url: string): string {
  let ipfsHash: string;
  if (url.length >= 46) {
    if (url.includes("Qm")) {
      let startingIndex = url.indexOf("Qm");
      ipfsHash = url.substring(startingIndex, startingIndex + 46);
    } else if (url.includes("bafy")) {
      let startingIndex = url.indexOf("bafy");
      ipfsHash = url.substring(startingIndex, startingIndex + 59);
    } else {
      ipfsHash = "";
    }
  } else {
    ipfsHash = "";
  }
  return ipfsHash;
}
