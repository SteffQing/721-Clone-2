import { json, Bytes, dataSource,
  JSONValue,
  JSONValueKind } from "@graphprotocol/graph-ts";
import { CollectionMetadata } from "../generated/schema";
import { TokenAttribute, TokenMetadata } from "../generated/schema";

export function handleMetadata(content: Bytes): void {
  let tokenMetadata = new TokenMetadata(dataSource.stringParam());

  const contentValue = json.try_fromBytes(content);
  if (contentValue.isOk) {
    const value = contentValue.value.toObject();
    if (value) {
      const image = value.get("image");
      const name = value.get("name");
      const description = value.get("description");
      if (name && image && description) {
        tokenMetadata.name = name.toString();
        tokenMetadata.image = image.toString();
        tokenMetadata.description = description.toString();
      }
      const attributes = value.get("attributes");
      if (attributes) {
        let attributeArray = attributes.toArray();
        setAttributes(attributeArray);
      }
      tokenMetadata.save();
    }
  }
}

function setAttributes(attributeArray: JSONValue[]): void {
  let length: number = attributeArray.length;
  for (let i = 0; i < length; i++) {
    let tokenAttributeEntityId = dataSource
      .stringParam()
      .concat("-attribute")
      .concat(i.toString());
    let tokenAttributeEntity = new TokenAttribute(tokenAttributeEntityId);
    let attributeObject = attributeArray[i].toObject();
    let try_traitType = attributeObject.get("trait_type");
    if (try_traitType == null) {
      try_traitType = attributeObject.get("traitType");
      if (try_traitType == null) {
        try_traitType = attributeObject.get("trait-type");
      }
    }
    let try_value = attributeObject.get("value");
    if (try_value && try_traitType) {
      tokenAttributeEntity.metadata = dataSource.stringParam();
      tokenAttributeEntity.traitType = try_traitType.toString();
      if (try_value.kind == JSONValueKind.STRING) {
        tokenAttributeEntity.value = try_value.toString();
      }
      if (try_value.kind == JSONValueKind.NUMBER) {
        tokenAttributeEntity.value = try_value.toI64().toString();
      }
      if (try_value.kind == JSONValueKind.BOOL) {
        tokenAttributeEntity.value = try_value.toBool().toString();
      }
      tokenAttributeEntity.save();
    }
  }
}

export function handleCollectionData(content: Bytes): void {
  let collectionData = new CollectionMetadata(dataSource.stringParam());

  const contentValue = json.try_fromBytes(content);
  if (contentValue.isOk) {
    const value = contentValue.value.toObject();
    if (value) {
      const banner = value.get("banner");
      const placeholder = value.get("placeholder");
      const small = value.get("small");
      const description = value.get("description");
      if (banner && placeholder && small && description) {
        collectionData.bannerImage = banner.toString();
        collectionData.placeholderImage = placeholder.toString();
        collectionData.smallImage = small.toString();
        collectionData.description = description.toString();
      }
      const twitter = value.get("twitter");
      const discord = value.get("discord");
      const telegram = value.get("telegram");
      const website = value.get("website");
      if (twitter) {
        collectionData.twitter = twitter.toString();
      }
      if (discord) {
        collectionData.discord = discord.toString();
      }
      if (telegram) {
        collectionData.telegram = telegram.toString();
      }
      if (website) {
        collectionData.website = website.toString();
      }
      collectionData.save();
    }
  }
}
