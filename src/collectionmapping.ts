import { json, Bytes, dataSource, log } from "@graphprotocol/graph-ts";
import { CollectionMetadata } from "../generated/schema";

export function handleMetadata(content: Bytes): void {
  let collectionData = new CollectionMetadata(dataSource.stringParam());
  const value = json.fromBytes(content).toObject();
  log.warning("Adding Collection data for: {}", [dataSource.stringParam()]);
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
